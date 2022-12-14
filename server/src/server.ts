import { spawnSync } from 'node:child_process'
import * as path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import * as TurndownService from 'turndown'
import * as LSP from 'vscode-languageserver/node'
import { CodeAction } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from './analyser'
import * as Builtins from './builtins'
import * as config from './config'
import Executables from './executables'
import { initializeParser } from './parser'
import * as ReservedWords from './reservedWords'
import { Linter } from './shellcheck'
import { BashCompletionItem, CompletionItemDataType } from './types'
import { uniqueBasedOnHash } from './util/array'
import { getShellDocumentation } from './util/sh'

const PARAMETER_EXPANSION_PREFIXES = new Set(['$', '${'])
const CONFIGURATION_SECTION = 'bashIde'

/**
 * The BashServer glues together the separate components to implement
 * the various parts of the Language Server Protocol.
 */
export default class BashServer {
  private analyzer: Analyzer
  private clientCapabilities: LSP.ClientCapabilities
  private config: config.Config
  private connection: LSP.Connection
  private documents: LSP.TextDocuments<TextDocument> = new LSP.TextDocuments(TextDocument)
  private executables: Executables
  private linter?: Linter
  private workspaceFolder: string | null
  private uriToCodeActions: { [uri: string]: CodeAction[] | undefined } = {}

  private constructor({
    analyzer,
    capabilities,
    connection,
    executables,
    linter,
    workspaceFolder,
  }: {
    analyzer: Analyzer
    capabilities: LSP.ClientCapabilities
    connection: LSP.Connection
    executables: Executables
    linter?: Linter
    workspaceFolder: string | null
  }) {
    this.analyzer = analyzer
    this.clientCapabilities = capabilities
    this.connection = connection
    this.executables = executables
    this.linter = linter
    this.workspaceFolder = workspaceFolder
    this.config = {} as any // NOTE: configured in updateConfiguration
    this.updateConfiguration(config.getDefaultConfiguration())
  }
  /**
   * Initialize the server based on a connection to the client and the protocols
   * initialization parameters.
   */
  public static async initialize(
    connection: LSP.Connection,
    { rootPath, rootUri, capabilities }: LSP.InitializeParams,
  ): // TODO: use workspaceFolders instead of rootPath
  Promise<BashServer> {
    const { PATH } = process.env
    const workspaceFolder = rootUri || rootPath || null

    if (!PATH) {
      throw new Error('Expected PATH environment variable to be set')
    }

    const parser = await initializeParser()
    const analyzer = new Analyzer({
      console: connection.console,
      parser,
      workspaceFolder,
    })

    const executables = await Executables.fromPath(PATH)

    return new BashServer({
      analyzer,
      capabilities,
      connection,
      executables,
      workspaceFolder,
    })
  }

  /**
   * Register handlers for the events from the Language Server Protocol that we
   * care about.
   */
  public register(connection: LSP.Connection): void {
    const hasConfigurationCapability = !!this.clientCapabilities?.workspace?.configuration

    let currentDocument: TextDocument | null = null
    let initialized = false // Whether the client finished initializing

    this.documents.listen(this.connection)

    this.documents.onDidChangeContent(({ document }) => {
      // The content of a text document has changed. This event is emitted
      // when the text document first opened or when its content has changed.
      currentDocument = document
      if (initialized) {
        this.analyzeAndLintDocument(document)
      }
    })

    this.documents.onDidClose((event) => {
      delete this.uriToCodeActions[event.document.uri]
    })

    // Register all the handlers for the LSP events.
    connection.onHover(this.onHover.bind(this))
    connection.onDefinition(this.onDefinition.bind(this))
    connection.onDocumentSymbol(this.onDocumentSymbol.bind(this))
    connection.onWorkspaceSymbol(this.onWorkspaceSymbol.bind(this))
    connection.onDocumentHighlight(this.onDocumentHighlight.bind(this))
    connection.onReferences(this.onReferences.bind(this))
    connection.onCompletion(this.onCompletion.bind(this))
    connection.onCompletionResolve(this.onCompletionResolve.bind(this))
    connection.onCodeAction(this.onCodeAction.bind(this))

    /**
     * The initialized notification is sent from the client to the server after
     * the client received the result of the initialize request but before the
     * client is sending any other request or notification to the server.
     * The server can use the initialized notification for example to dynamically
     * register capabilities. The initialized notification may only be sent once.
     */
    connection.onInitialized(async () => {
      const { config: environmentConfig, environmentVariablesUsed } =
        config.getConfigFromEnvironmentVariables()

      if (environmentVariablesUsed.length > 0) {
        this.updateConfiguration(environmentConfig)
        connection.console.warn(
          `Environment variable configuration is being deprecated, please use workspace configuration. The following environment variables were used: ${environmentVariablesUsed.join(
            ', ',
          )}`,
        )
      }

      if (hasConfigurationCapability) {
        // Register event for all configuration changes.
        connection.client.register(LSP.DidChangeConfigurationNotification.type, {
          section: CONFIGURATION_SECTION,
        })

        // get current configuration from client
        const configObject = await connection.workspace.getConfiguration(
          CONFIGURATION_SECTION,
        )
        this.updateConfiguration(configObject)
        this.connection.console.log('Configuration loaded from client')
      }

      initialized = true
      if (currentDocument) {
        // If we already have a document, analyze it now that we're initialized
        // and the linter is ready.
        this.analyzeAndLintDocument(currentDocument)
      }

      // NOTE: we do not block the server initialization on this background analysis.
      return { backgroundAnalysisCompleted: this.startBackgroundAnalysis() }
    })

    // Respond to changes in the configuration.
    connection.onDidChangeConfiguration(({ settings }) => {
      const configChanged = this.updateConfiguration(settings[CONFIGURATION_SECTION])
      if (configChanged && initialized) {
        this.connection.console.log('Configuration changed')
        this.startBackgroundAnalysis()
        if (currentDocument) {
          this.uriToCodeActions[currentDocument.uri] = undefined
          this.analyzeAndLintDocument(currentDocument)
        }
      }
    })

    // FIXME: re-lint on workspace folder change
  }

  private async startBackgroundAnalysis(): Promise<{ filesParsed: number }> {
    const { workspaceFolder } = this
    if (workspaceFolder) {
      return this.analyzer.initiateBackgroundAnalysis({
        globPattern: this.config.globPattern,
        backgroundAnalysisMaxFiles: this.config.backgroundAnalysisMaxFiles,
      })
    }

    return Promise.resolve({ filesParsed: 0 })
  }

  private updateConfiguration(configObject: any): boolean {
    if (typeof configObject === 'object') {
      try {
        const newConfig = config.ConfigSchema.parse(configObject)

        if (!isDeepStrictEqual(this.config, newConfig)) {
          this.config = newConfig

          // NOTE: I don't really like this... An alternative would be to pass in the
          // shellcheck executable path when linting. We would need to handle
          // resetting the canLint flag though.

          const { shellcheckPath } = this.config
          if (!shellcheckPath) {
            this.connection.console.log(
              'ShellCheck linting is disabled as "shellcheckPath" was not set',
            )
            this.linter = undefined
          } else {
            this.linter = new Linter({
              console: this.connection.console,
              executablePath: shellcheckPath,
            })
          }

          this.analyzer.setIncludeAllWorkspaceSymbols(
            this.config.includeAllWorkspaceSymbols,
          )

          return true
        }
      } catch (err) {
        this.connection.console.warn(`updateConfiguration: failed with ${err}`)
      }
    }

    return false
  }

  /**
   * Analyze and lint the given document.
   */
  public async analyzeAndLintDocument(document: TextDocument) {
    const { uri } = document

    let diagnostics: LSP.Diagnostic[] = []

    // Load the tree for the modified contents into the analyzer:
    const analyzeDiagnostics = this.analyzer.analyze({ uri, document })
    // Treesitter's diagnostics can be a bit inaccurate, so we only merge the
    // analyzer's diagnostics if the setting is enabled:
    if (this.config.highlightParsingErrors) {
      diagnostics = diagnostics.concat(analyzeDiagnostics)
    }

    // Run ShellCheck diagnostics:
    if (this.linter) {
      try {
        const sourceFolders = this.workspaceFolder ? [this.workspaceFolder] : []
        const { diagnostics: lintDiagnostics, codeActions } = await this.linter.lint(
          document,
          sourceFolders,
          this.config.shellcheckArguments,
        )
        diagnostics = diagnostics.concat(lintDiagnostics)
        this.uriToCodeActions[uri] = codeActions
      } catch (err) {
        this.connection.console.error(`Error while linting: ${err}`)
      }
    }

    this.connection.sendDiagnostics({ uri, version: document.version, diagnostics })
  }

  /**
   * The parts of the Language Server Protocol that we are currently supporting.
   */
  public capabilities(): LSP.ServerCapabilities {
    return {
      // For now we're using full-sync even though tree-sitter has great support
      // for partial updates.
      textDocumentSync: LSP.TextDocumentSyncKind.Full,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['$', '{'],
      },
      hoverProvider: true,
      documentHighlightProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      referencesProvider: true,
      codeActionProvider: {
        codeActionKinds: [LSP.CodeActionKind.QuickFix],
        resolveProvider: false,
        workDoneProgress: false,
      },
    }
  }

  private getWordAtPoint(
    params: LSP.ReferenceParams | LSP.TextDocumentPositionParams,
  ): string | null {
    return this.analyzer.wordAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character,
    )
  }

  private getCommandNameAtPoint(
    params: LSP.ReferenceParams | LSP.TextDocumentPositionParams,
  ): string | null {
    return this.analyzer.commandNameAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character,
    )
  }

  private logRequest({
    request,
    params,
    word,
  }: {
    request: string
    params: LSP.ReferenceParams | LSP.TextDocumentPositionParams
    word?: string | null
  }) {
    const wordLog = word ? `"${word}"` : 'null'
    this.connection.console.log(
      `${request} ${params.position.line}:${params.position.character} word=${wordLog}`,
    )
  }

  private getDocumentationForSymbol({
    currentUri,
    symbol,
  }: {
    symbol: LSP.SymbolInformation
    currentUri: string
  }): LSP.MarkupContent {
    const symbolUri = symbol.location.uri
    const symbolStartLine = symbol.location.range.start.line

    const commentAboveSymbol = this.analyzer.commentsAbove(symbolUri, symbolStartLine)
    const symbolDocumentation = commentAboveSymbol ? `\n\n${commentAboveSymbol}` : ''
    const hoverHeader = `${symbolKindToDescription(symbol.kind)}: **${symbol.name}**`
    const symbolLocation =
      symbolUri !== currentUri
        ? `in ${path.relative(path.dirname(currentUri), symbolUri)}`
        : `on line ${symbolStartLine + 1}`

    // TODO: An improvement could be to add show the symbol definition in the hover instead
    // of the defined location – similar to how VSCode works for languages like TypeScript.

    return getMarkdownContent(
      `${hoverHeader} - *defined ${symbolLocation}*${symbolDocumentation}`,
    )
  }

  private getCompletionItemsForSymbols({
    symbols,
    currentUri,
  }: {
    symbols: LSP.SymbolInformation[]
    currentUri: string
  }): BashCompletionItem[] {
    return deduplicateSymbols({ symbols, currentUri }).map(
      (symbol: LSP.SymbolInformation) => ({
        label: symbol.name,
        kind: symbolKindToCompletionKind(symbol.kind),
        data: {
          name: symbol.name,
          type: CompletionItemDataType.Symbol,
        },
        documentation:
          symbol.location.uri !== currentUri
            ? this.getDocumentationForSymbol({
                currentUri,
                symbol,
              })
            : undefined,
      }),
    )
  }

  private async onHover(
    params: LSP.TextDocumentPositionParams,
  ): Promise<LSP.Hover | null> {
    const word = this.getWordAtPoint(params)
    const currentUri = params.textDocument.uri

    this.logRequest({ request: 'onHover', params, word })

    if (!word || word.startsWith('#')) {
      return null
    }

    const { explainshellEndpoint } = this.config
    if (explainshellEndpoint) {
      try {
        const { helpHTML } = await this.analyzer.getExplainshellDocumentation({
          params,
          endpoint: explainshellEndpoint,
        })

        if (helpHTML) {
          return {
            contents: {
              kind: 'markdown',
              value: new TurndownService().turndown(helpHTML),
            },
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : error
        this.connection.console.warn(
          `getExplainshellDocumentation exception: ${errorMessage}`,
        )
      }
    }

    if (
      ReservedWords.isReservedWord(word) ||
      Builtins.isBuiltin(word) ||
      this.executables.isExecutableOnPATH(word)
    ) {
      const shellDocumentation = await getShellDocumentation({ word })
      if (shellDocumentation) {
        return { contents: getMarkdownContent(shellDocumentation, 'man') }
      }
    } else {
      const symbolDocumentation = deduplicateSymbols({
        symbols: this.analyzer.findSymbolsMatchingWord({
          exactMatch: true,
          uri: currentUri,
          word,
        }),
        currentUri,
      })
        // do not return hover referencing for the current line
        .filter((symbol) => symbol.location.range.start.line !== params.position.line)
        .map((symbol: LSP.SymbolInformation) =>
          this.getDocumentationForSymbol({ currentUri, symbol }),
        )

      if (symbolDocumentation.length === 1) {
        return { contents: symbolDocumentation[0] }
      }
    }

    return null
  }

  private onDefinition(params: LSP.TextDocumentPositionParams): LSP.Definition | null {
    const word = this.getWordAtPoint(params)
    this.logRequest({ request: 'onDefinition', params, word })
    if (!word) {
      return null
    }
    return this.analyzer.findDefinition({
      position: params.position,
      uri: params.textDocument.uri,
      word,
    })
  }

  private onDocumentSymbol(params: LSP.DocumentSymbolParams): LSP.SymbolInformation[] {
    this.connection.console.log(`onDocumentSymbol`)
    return this.analyzer.findSymbolsForFile({ uri: params.textDocument.uri })
  }

  private onWorkspaceSymbol(params: LSP.WorkspaceSymbolParams): LSP.SymbolInformation[] {
    this.connection.console.log('onWorkspaceSymbol')
    return this.analyzer.search(params.query)
  }

  private onDocumentHighlight(
    params: LSP.TextDocumentPositionParams,
  ): LSP.DocumentHighlight[] | null {
    const word = this.getWordAtPoint(params)
    this.logRequest({ request: 'onDocumentHighlight', params, word })

    if (!word) {
      return []
    }

    return this.analyzer
      .findOccurrences(params.textDocument.uri, word)
      .map((n) => ({ range: n.range }))
  }

  private onReferences(params: LSP.ReferenceParams): LSP.Location[] | null {
    const word = this.getWordAtPoint(params)
    this.logRequest({ request: 'onReferences', params, word })
    if (!word) {
      return null
    }
    return this.analyzer.findReferences(word)
  }

  private onCompletion(params: LSP.TextDocumentPositionParams): BashCompletionItem[] {
    const word = this.getWordAtPoint({
      ...params,
      position: {
        line: params.position.line,
        // Go one character back to get completion on the current word
        character: Math.max(params.position.character - 1, 0),
      },
    })
    this.logRequest({ request: 'onCompletion', params, word })

    if (word && word.startsWith('#')) {
      // Inside a comment block
      return []
    }
    if (word && word === '{') {
      // We should not complete when it is not prefixed by a $.
      // This case needs to be here
      // because { is a completionProvider triggerCharacter.
      return []
    }

    let options: string[] = []
    if (word && word.startsWith('-')) {
      const commandName = this.getCommandNameAtPoint({
        ...params,
        position: {
          line: params.position.line,
          // Go one character back to get completion on the current word
          character: Math.max(params.position.character - 1, 0),
        },
      })

      if (commandName) {
        options = getCommandOptions(commandName, word)
      }
    }

    const currentUri = params.textDocument.uri

    // TODO: an improvement here would be to detect if the current word is
    // not only a parameter expansion prefix, but also if the word is actually
    // inside a parameter expansion (e.g. auto completing on a word $MY_VARIA).
    const shouldCompleteOnVariables = word
      ? PARAMETER_EXPANSION_PREFIXES.has(word)
      : false

    const symbolCompletions =
      word === null
        ? []
        : this.getCompletionItemsForSymbols({
            symbols: shouldCompleteOnVariables
              ? this.analyzer.getAllVariableSymbols({ uri: currentUri })
              : this.analyzer.findSymbolsMatchingWord({
                  exactMatch: false,
                  uri: currentUri,
                  word,
                }),
            currentUri,
          })

    if (shouldCompleteOnVariables) {
      // In case we auto complete on a word that starts a parameter expansion,
      // we do not return anything else than variable/parameter suggestions.
      // Note: that LSP clients should not call onCompletion in the middle
      // of a word, so the following should work for client.
      return symbolCompletions
    }

    const reservedWordsCompletions = ReservedWords.LIST.map((reservedWord) => ({
      label: reservedWord,
      kind: LSP.CompletionItemKind.Keyword,
      data: {
        name: reservedWord,
        type: CompletionItemDataType.ReservedWord,
      },
    }))

    const programCompletions = this.executables
      .list()
      .filter((executable) => !Builtins.isBuiltin(executable))
      .map((executable) => {
        return {
          label: executable,
          kind: LSP.CompletionItemKind.Function,
          data: {
            name: executable,
            type: CompletionItemDataType.Executable,
          },
        }
      })

    const builtinsCompletions = Builtins.LIST.map((builtin) => ({
      label: builtin,
      kind: LSP.CompletionItemKind.Function,
      data: {
        name: builtin,
        type: CompletionItemDataType.Builtin,
      },
    }))

    const optionsCompletions = options.map((option) => ({
      label: option,
      kind: LSP.CompletionItemKind.Constant,
      data: {
        name: option,
        type: CompletionItemDataType.Symbol,
      },
    }))

    const allCompletions = [
      ...reservedWordsCompletions,
      ...symbolCompletions,
      ...programCompletions,
      ...builtinsCompletions,
      ...optionsCompletions,
    ]

    if (word) {
      // Filter to only return suffixes of the current word
      return allCompletions.filter((item) => item.label.startsWith(word))
    }

    return allCompletions
  }

  private async onCodeAction(params: LSP.CodeActionParams): Promise<LSP.CodeAction[]> {
    const codeActions = this.uriToCodeActions[params.textDocument.uri]

    if (!codeActions) {
      return []
    }

    const getDiagnosticsFingerPrint = (diagnostics?: LSP.Diagnostic[]): string[] =>
      (diagnostics &&
        diagnostics
          .map(({ code, source, range }) =>
            code !== undefined && source && range
              ? JSON.stringify({
                  code,
                  source,
                  range,
                })
              : null,
          )
          .filter((fingerPrint): fingerPrint is string => fingerPrint != null)) ||
      []

    const paramsDiagnosticsKeys = getDiagnosticsFingerPrint(params.context.diagnostics)

    // find actions that match the paramsDiagnosticsKeys
    const actions = codeActions.filter((action) => {
      const actionDiagnosticsKeys = getDiagnosticsFingerPrint(action.diagnostics)
      // actions without diagnostics are always returned
      if (actionDiagnosticsKeys.length === 0) {
        return true
      }

      return actionDiagnosticsKeys.some((actionDiagnosticKey) =>
        paramsDiagnosticsKeys.includes(actionDiagnosticKey),
      )
    })

    return actions
  }

  private async onCompletionResolve(
    item: LSP.CompletionItem,
  ): Promise<LSP.CompletionItem> {
    const {
      data: { name, type },
    } = item as BashCompletionItem

    this.connection.console.log(`onCompletionResolve name=${name} type=${type}`)

    try {
      let documentation = null

      if (
        type === CompletionItemDataType.Executable ||
        type === CompletionItemDataType.Builtin ||
        type === CompletionItemDataType.ReservedWord
      ) {
        documentation = await getShellDocumentation({ word: name })
      }

      return documentation
        ? {
            ...item,
            documentation: getMarkdownContent(documentation, 'man'),
          }
        : item
    } catch (error) {
      return item
    }
  }
}

/**
 * Deduplicate symbols by prioritizing the current file.
 */
function deduplicateSymbols({
  symbols,
  currentUri,
}: {
  symbols: LSP.SymbolInformation[]
  currentUri: string
}) {
  const isCurrentFile = ({ location: { uri } }: LSP.SymbolInformation) =>
    uri === currentUri

  const getSymbolId = ({ name, kind }: LSP.SymbolInformation) => `${name}${kind}`

  const symbolsCurrentFile = symbols.filter((s) => isCurrentFile(s))

  const symbolsOtherFiles = symbols
    .filter((s) => !isCurrentFile(s))
    // Remove identical symbols matching current file
    .filter(
      (symbolOtherFiles) =>
        !symbolsCurrentFile.some(
          (symbolCurrentFile) =>
            getSymbolId(symbolCurrentFile) === getSymbolId(symbolOtherFiles),
        ),
    )

  return uniqueBasedOnHash([...symbolsCurrentFile, ...symbolsOtherFiles], getSymbolId)
}

function symbolKindToCompletionKind(s: LSP.SymbolKind): LSP.CompletionItemKind {
  switch (s) {
    case LSP.SymbolKind.File:
      return LSP.CompletionItemKind.File
    case LSP.SymbolKind.Module:
    case LSP.SymbolKind.Namespace:
    case LSP.SymbolKind.Package:
      return LSP.CompletionItemKind.Module
    case LSP.SymbolKind.Class:
      return LSP.CompletionItemKind.Class
    case LSP.SymbolKind.Method:
      return LSP.CompletionItemKind.Method
    case LSP.SymbolKind.Property:
      return LSP.CompletionItemKind.Property
    case LSP.SymbolKind.Field:
      return LSP.CompletionItemKind.Field
    case LSP.SymbolKind.Constructor:
      return LSP.CompletionItemKind.Constructor
    case LSP.SymbolKind.Enum:
      return LSP.CompletionItemKind.Enum
    case LSP.SymbolKind.Interface:
      return LSP.CompletionItemKind.Interface
    case LSP.SymbolKind.Function:
      return LSP.CompletionItemKind.Function
    case LSP.SymbolKind.Variable:
      return LSP.CompletionItemKind.Variable
    case LSP.SymbolKind.Constant:
      return LSP.CompletionItemKind.Constant
    case LSP.SymbolKind.String:
    case LSP.SymbolKind.Number:
    case LSP.SymbolKind.Boolean:
    case LSP.SymbolKind.Array:
    case LSP.SymbolKind.Key:
    case LSP.SymbolKind.Null:
      return LSP.CompletionItemKind.Text
    case LSP.SymbolKind.Object:
      return LSP.CompletionItemKind.Module
    case LSP.SymbolKind.EnumMember:
      return LSP.CompletionItemKind.EnumMember
    case LSP.SymbolKind.Struct:
      return LSP.CompletionItemKind.Struct
    case LSP.SymbolKind.Event:
      return LSP.CompletionItemKind.Event
    case LSP.SymbolKind.Operator:
      return LSP.CompletionItemKind.Operator
    case LSP.SymbolKind.TypeParameter:
      return LSP.CompletionItemKind.TypeParameter
    default:
      return LSP.CompletionItemKind.Text
  }
}

function symbolKindToDescription(s: LSP.SymbolKind): string {
  switch (s) {
    case LSP.SymbolKind.Function:
      return 'Function'
    case LSP.SymbolKind.Variable:
      return 'Variable'
    default:
      return 'Keyword'
  }
}

function getMarkdownContent(documentation: string, language?: string): LSP.MarkupContent {
  return {
    value: language
      ? // eslint-disable-next-line prefer-template
        ['``` ' + language, documentation, '```'].join('\n')
      : documentation,
    kind: LSP.MarkupKind.Markdown,
  }
}

function getCommandOptions(name: string, word: string): string[] {
  // TODO: The options could be cached.
  const options = spawnSync(path.join(__dirname, '../src/get-options.sh'), [name, word])

  if (options.status !== 0) {
    return []
  }

  return options.stdout
    .toString()
    .split('\t')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}
