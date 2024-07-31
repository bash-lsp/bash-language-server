import { spawnSync } from 'node:child_process'
import * as path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import * as TurndownService from 'turndown'
import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from './analyser'
import * as Builtins from './builtins'
import * as config from './config'
import Executables from './executables'
import { initializeParser } from './parser'
import * as ReservedWords from './reserved-words'
import { Linter, LintingResult } from './shellcheck'
import { Formatter } from './shfmt'
import { SNIPPETS } from './snippets'
import { BashCompletionItem, CompletionItemDataType } from './types'
import { uniqueBasedOnHash } from './util/array'
import { logger, setLogConnection, setLogLevel } from './util/logger'
import { isPositionIncludedInRange } from './util/lsp'
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
  private formatter?: Formatter
  private workspaceFolder: string | null
  private uriToCodeActions: {
    [uri: string]: LintingResult['codeActions'] | undefined
  } = {}

  private constructor({
    analyzer,
    capabilities,
    connection,
    executables,
    linter,
    formatter,
    workspaceFolder,
  }: {
    analyzer: Analyzer
    capabilities: LSP.ClientCapabilities
    connection: LSP.Connection
    executables: Executables
    linter?: Linter
    formatter?: Formatter
    workspaceFolder: string | null
  }) {
    this.analyzer = analyzer
    this.clientCapabilities = capabilities
    this.connection = connection
    this.executables = executables
    this.linter = linter
    this.formatter = formatter
    this.workspaceFolder = workspaceFolder
    this.config = {} as any // NOTE: configured in updateConfiguration
    this.updateConfiguration(config.getDefaultConfiguration(), true)
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
    setLogConnection(connection)

    logger.debug('Initializing...')

    const { PATH } = process.env
    const workspaceFolder = rootUri || rootPath || null

    if (!PATH) {
      throw new Error('Expected PATH environment variable to be set')
    }

    const parser = await initializeParser()
    const analyzer = new Analyzer({
      parser,
      workspaceFolder,
    })

    const executables = await Executables.fromPath(PATH)

    const server = new BashServer({
      analyzer,
      capabilities,
      connection,
      executables,
      workspaceFolder,
    })

    logger.debug('Initialized')

    return server
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
      renameProvider: { prepareProvider: true },
      documentFormattingProvider: true,
    }
  }

  /**
   * Register handlers for the events from the Language Server Protocol that we
   * care about.
   */
  public register(connection: LSP.Connection): void {
    const hasConfigurationCapability = !!this.clientCapabilities?.workspace?.configuration
    const canDynamicallyRegisterConfigurationChangeNotification =
      !!this.clientCapabilities?.workspace?.didChangeConfiguration?.dynamicRegistration

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
      connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] })
      delete this.uriToCodeActions[event.document.uri]
    })

    // Register all the handlers for the LSP events.
    connection.onCodeAction(this.onCodeAction.bind(this))
    connection.onCompletion(this.onCompletion.bind(this))
    connection.onCompletionResolve(this.onCompletionResolve.bind(this))
    connection.onDefinition(this.onDefinition.bind(this))
    connection.onDocumentHighlight(this.onDocumentHighlight.bind(this))
    connection.onDocumentSymbol(this.onDocumentSymbol.bind(this))
    connection.onHover(this.onHover.bind(this))
    connection.onReferences(this.onReferences.bind(this))
    connection.onWorkspaceSymbol(this.onWorkspaceSymbol.bind(this))
    connection.onPrepareRename(this.onPrepareRename.bind(this))
    connection.onRenameRequest(this.onRenameRequest.bind(this))
    connection.onDocumentFormatting(this.onDocumentFormatting.bind(this))

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
        logger.warn(
          `Environment variable configuration is being deprecated, please use workspace configuration. The following environment variables were used: ${environmentVariablesUsed.join(
            ', ',
          )}`,
        )
      }

      if (hasConfigurationCapability) {
        // Register event for all configuration changes.
        if (canDynamicallyRegisterConfigurationChangeNotification) {
          connection.client.register(LSP.DidChangeConfigurationNotification.type, {
            section: CONFIGURATION_SECTION,
          })
        }

        // get current configuration from client
        const configObject = await connection.workspace.getConfiguration(
          CONFIGURATION_SECTION,
        )
        this.updateConfiguration(configObject)
        logger.debug('Configuration loaded from client')
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
        logger.debug('Configuration changed')
        this.startBackgroundAnalysis()
        if (currentDocument) {
          this.uriToCodeActions[currentDocument.uri] = undefined
          this.analyzeAndLintDocument(currentDocument)
        }
      }
    })

    // FIXME: re-lint on workspace folder change
  }

  // ==================
  // Internal functions
  // ==================

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

  private updateConfiguration(configObject: any, isDefaultConfig = false): boolean {
    if (typeof configObject === 'object' && configObject !== null) {
      try {
        const newConfig = config.ConfigSchema.parse(configObject)

        if (!isDeepStrictEqual(this.config, newConfig)) {
          this.config = newConfig

          // NOTE: I don't really like this... An alternative would be to pass in the
          // shellcheck executable path when linting. We would need to handle
          // resetting the canLint flag though.

          const { shellcheckPath } = this.config
          if (!shellcheckPath) {
            logger.info('ShellCheck linting is disabled as "shellcheckPath" was not set')
            this.linter = undefined
          } else {
            this.linter = new Linter({ executablePath: shellcheckPath })
          }

          const shfmtPath = this.config.shfmt?.path
          if (!shfmtPath) {
            logger.info('Shfmt formatting is disabled as "shfmt.path" was not set')
            this.formatter = undefined
          } else {
            this.formatter = new Formatter({ executablePath: shfmtPath })
          }

          this.analyzer.setEnableSourceErrorDiagnostics(
            this.config.enableSourceErrorDiagnostics,
          )

          this.analyzer.setIncludeAllWorkspaceSymbols(
            this.config.includeAllWorkspaceSymbols,
          )

          if (!isDefaultConfig) {
            // We skip setting the log level as the default configuration should
            // not override the environment defined log level.
            setLogLevel(this.config.logLevel)
          }

          return true
        }
      } catch (err) {
        logger.warn(`updateConfiguration: failed with ${err}`)
      }
    }

    return false
  }

  /**
   * Analyze and lint the given document.
   */
  public async analyzeAndLintDocument(document: TextDocument) {
    const { uri } = document

    // Load the tree for the modified contents into the analyzer:
    let diagnostics = this.analyzer.analyze({ uri, document })

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
        logger.error(`Error while linting: ${err}`)
      }
    }

    this.connection.sendDiagnostics({ uri, version: document.version, diagnostics })
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
    logger.debug(
      `${request} ${params.position.line}:${params.position.character} word=${wordLog}`,
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
  private getDocumentationForSymbol({
    currentUri,
    symbol,
  }: {
    symbol: LSP.SymbolInformation
    currentUri: string
  }): LSP.MarkupContent {
    logger.debug(
      `getDocumentationForSymbol: symbol=${symbol.name} uri=${symbol.location.uri}`,
    )
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

  private throwResponseError(message: string, code = LSP.LSPErrorCodes.RequestFailed) {
    throw new LSP.ResponseError(code, message)
  }

  // ==============================
  // Language server event handlers
  // ==============================

  private async onCodeAction(params: LSP.CodeActionParams): Promise<LSP.CodeAction[]> {
    const codeActionsForUri = this.uriToCodeActions[params.textDocument.uri] || {}

    const codeActions = params.context.diagnostics
      .map(({ data }) => codeActionsForUri[data?.id])
      .filter((action): action is LSP.CodeAction => action != null)

    logger.debug(`onCodeAction: found ${codeActions.length} code action(s)`)

    return codeActions
  }

  private onCompletion(params: LSP.TextDocumentPositionParams): BashCompletionItem[] {
    const word = this.analyzer.wordAtPointFromTextPosition({
      ...params,
      position: {
        line: params.position.line,
        // Go one character back to get completion on the current word
        character: Math.max(params.position.character - 1, 0),
      },
    })

    this.logRequest({ request: 'onCompletion', params, word })

    if (word?.startsWith('#')) {
      // Inside a comment block
      return []
    }

    if (word === '{') {
      // We should not complete when it is not prefixed by a $.
      // This case needs to be here as "{" is a completionProvider triggerCharacter.
      return []
    }

    if (!word) {
      const nextCharacter = this.analyzer.getDocument(params.textDocument.uri)?.getText({
        start: params.position,
        end: { ...params.position, character: params.position.character + 1 },
      })
      const isNextCharacterSpaceOrEmpty = nextCharacter === '' || nextCharacter === ' '
      if (!isNextCharacterSpaceOrEmpty) {
        // We are in the middle of something, so don't complete
        return []
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
              ? this.analyzer.getAllVariables({
                  uri: currentUri,
                  position: params.position,
                })
              : this.analyzer.findDeclarationsMatchingWord({
                  exactMatch: false,
                  uri: currentUri,
                  word,
                  position: params.position,
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
            type: CompletionItemDataType.Executable,
          },
        }
      })

    const builtinsCompletions = Builtins.LIST.map((builtin) => ({
      label: builtin,
      kind: LSP.CompletionItemKind.Function,
      data: {
        type: CompletionItemDataType.Builtin,
      },
    }))

    let optionsCompletions: BashCompletionItem[] = []
    if (word?.startsWith('-')) {
      const commandName = this.analyzer.commandNameAtPoint(
        params.textDocument.uri,
        params.position.line,
        // Go one character back to get completion on the current word
        Math.max(params.position.character - 1, 0),
      )

      if (commandName) {
        optionsCompletions = getCommandOptions(commandName, word).map((option) => ({
          label: option,
          kind: LSP.CompletionItemKind.Constant,
          data: {
            type: CompletionItemDataType.Symbol,
          },
          textEdit: {
            newText: option.slice(word.length),
            range: {
              start: {
                character: params.position.character,
                line: params.position.line,
              },
              end: {
                character: params.position.character,
                line: params.position.line,
              },
            },
          },
        }))
      }
    }

    const allCompletions = [
      ...reservedWordsCompletions,
      ...symbolCompletions,
      ...programCompletions,
      ...builtinsCompletions,
      ...optionsCompletions,
      ...SNIPPETS,
    ]

    if (word) {
      // Filter to only return suffixes of the current word
      return allCompletions.filter((item) => item.label.startsWith(word))
    }

    return allCompletions
  }

  private async onCompletionResolve(
    item: LSP.CompletionItem,
  ): Promise<LSP.CompletionItem> {
    const {
      label,
      data: { type },
    } = item as BashCompletionItem

    logger.debug(`onCompletionResolve label=${label} type=${type}`)

    try {
      let documentation = null

      if (
        type === CompletionItemDataType.Executable ||
        type === CompletionItemDataType.Builtin ||
        type === CompletionItemDataType.ReservedWord
      ) {
        documentation = await getShellDocumentation({ word: label })
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

  private onDefinition(params: LSP.TextDocumentPositionParams): LSP.Definition | null {
    const word = this.analyzer.wordAtPointFromTextPosition(params)
    this.logRequest({ request: 'onDefinition', params, word })
    if (!word) {
      return null
    }
    return this.analyzer.findDeclarationLocations({
      position: params.position,
      uri: params.textDocument.uri,
      word,
    })
  }

  private onDocumentHighlight(
    params: LSP.TextDocumentPositionParams,
  ): LSP.DocumentHighlight[] | null {
    const word = this.analyzer.wordAtPointFromTextPosition(params)
    this.logRequest({ request: 'onDocumentHighlight', params, word })

    if (!word) {
      return []
    }

    return this.analyzer
      .findOccurrences(params.textDocument.uri, word)
      .map((n) => ({ range: n.range }))
  }

  private onDocumentSymbol(params: LSP.DocumentSymbolParams): LSP.SymbolInformation[] {
    // TODO: ideally this should return LSP.DocumentSymbol[] instead of LSP.SymbolInformation[]
    // which is a hierarchy of symbols.
    // https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentSymbol
    logger.debug(`onDocumentSymbol`)
    return this.analyzer.getDeclarationsForUri({ uri: params.textDocument.uri })
  }

  private async onHover(
    params: LSP.TextDocumentPositionParams,
  ): Promise<LSP.Hover | null> {
    const word = this.analyzer.wordAtPointFromTextPosition(params)
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
        logger.warn(`getExplainshellDocumentation exception: ${errorMessage}`)
      }
    }

    const symbolsMatchingWord = this.analyzer.findDeclarationsMatchingWord({
      exactMatch: true,
      uri: currentUri,
      word,
      position: params.position,
    })
    if (
      ReservedWords.isReservedWord(word) ||
      Builtins.isBuiltin(word) ||
      (this.executables.isExecutableOnPATH(word) && symbolsMatchingWord.length == 0)
    ) {
      logger.debug(
        `onHover: getting shell documentation for reserved word or builtin or executable`,
      )
      const shellDocumentation = await getShellDocumentation({ word })
      if (shellDocumentation) {
        return { contents: getMarkdownContent(shellDocumentation, 'man') }
      }
    } else {
      const symbolDocumentation = deduplicateSymbols({
        symbols: symbolsMatchingWord,
        currentUri,
      })
        // do not return hover referencing for the current line
        .filter(
          (symbol) =>
            symbol.location.uri !== currentUri ||
            symbol.location.range.start.line !== params.position.line,
        )
        .map((symbol: LSP.SymbolInformation) =>
          this.getDocumentationForSymbol({ currentUri, symbol }),
        )

      if (symbolDocumentation.length === 1) {
        return { contents: symbolDocumentation[0] }
      }
    }

    return null
  }

  private onReferences(params: LSP.ReferenceParams): LSP.Location[] | null {
    const word = this.analyzer.wordAtPointFromTextPosition(params)
    this.logRequest({ request: 'onReferences', params, word })
    if (!word) {
      return null
    }

    const isCurrentDeclaration = (l: LSP.Location) =>
      l.uri === params.textDocument.uri &&
      isPositionIncludedInRange(params.position, l.range)

    return this.analyzer
      .findReferences(word)
      .filter((l) => params.context.includeDeclaration || !isCurrentDeclaration(l))
  }

  private onWorkspaceSymbol(params: LSP.WorkspaceSymbolParams): LSP.SymbolInformation[] {
    logger.debug('onWorkspaceSymbol')
    return this.analyzer.findDeclarationsWithFuzzySearch(params.query)
  }

  private onPrepareRename(params: LSP.PrepareRenameParams): LSP.Range | null {
    const symbol = this.analyzer.symbolAtPointFromTextPosition(params)
    this.logRequest({ request: 'onPrepareRename', params, word: symbol?.word })

    if (
      !symbol ||
      (symbol.kind === LSP.SymbolKind.Variable &&
        (symbol.word === '_' || !/^[a-z_][\w]*$/i.test(symbol.word)))
    ) {
      return null
    }

    return symbol.range
  }

  private onRenameRequest(params: LSP.RenameParams): LSP.WorkspaceEdit | null {
    const symbol = this.analyzer.symbolAtPointFromTextPosition(params)
    this.logRequest({ request: 'onRenameRequest', params, word: symbol?.word })

    if (!symbol) {
      return null
    }

    if (
      symbol.kind === LSP.SymbolKind.Variable &&
      (params.newName === '_' || !/^[a-z_][\w]*$/i.test(params.newName))
    ) {
      this.throwResponseError('Invalid variable name given.')
    }

    if (symbol.kind === LSP.SymbolKind.Function && params.newName.includes('$')) {
      this.throwResponseError('Invalid function name given.')
    }

    const { declaration, parent } = this.analyzer.findOriginalDeclaration({
      position: params.position,
      uri: params.textDocument.uri,
      word: symbol.word,
      kind: symbol.kind,
    })

    // File-wide rename
    if (!declaration || parent) {
      return <LSP.WorkspaceEdit>{
        changes: {
          [params.textDocument.uri]: this.analyzer
            .findOccurrencesWithin({
              uri: params.textDocument.uri,
              word: symbol.word,
              kind: symbol.kind,
              start: declaration?.range.start,
              scope: parent?.range,
            })
            .map((r) => LSP.TextEdit.replace(r, params.newName)),
        },
      }
    }

    // Workspace-wide rename
    const edits: LSP.WorkspaceEdit = {}
    edits.changes = {
      [declaration.uri]: this.analyzer
        .findOccurrencesWithin({
          uri: declaration.uri,
          word: symbol.word,
          kind: symbol.kind,
          start: declaration.range.start,
        })
        .map((r) => LSP.TextEdit.replace(r, params.newName)),
    }
    for (const uri of this.analyzer.findAllLinkedUris(declaration.uri)) {
      edits.changes[uri] = this.analyzer
        .findOccurrencesWithin({
          uri,
          word: symbol.word,
          kind: symbol.kind,
        })
        .map((r) => LSP.TextEdit.replace(r, params.newName))
    }
    return edits
  }

  private async onDocumentFormatting(
    params: LSP.DocumentFormattingParams,
  ): Promise<LSP.TextEdit[] | null> {
    if (this.formatter) {
      try {
        const document = this.documents.get(params.textDocument.uri)
        if (!document) {
          logger.error(`Error getting document: ${params.textDocument.uri}`)
          return null
        }

        return await this.formatter.format(document, params.options, this.config.shfmt)
      } catch (err) {
        logger.error(`Error while formatting: ${err}`)
      }
    }

    return null
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

  // NOTE: it might be that uniqueBasedOnHash is not needed anymore
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

export function getCommandOptions(name: string, word: string): string[] {
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
