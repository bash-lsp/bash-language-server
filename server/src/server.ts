import * as path from 'path'
import * as TurndownService from 'turndown'
import * as LSP from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from './analyser'
import * as Builtins from './builtins'
import * as config from './config'
import Executables from './executables'
import { initializeParser } from './parser'
import * as ReservedWords from './reservedWords'
import { BashCompletionItem, CompletionItemDataType } from './types'
import { uniqueBasedOnHash } from './util/array'
import { getShellDocumentation } from './util/sh'

/**
 * The BashServer glues together the separate components to implement
 * the various parts of the Language Server Protocol.
 */
export default class BashServer {
  /**
   * Initialize the server based on a connection to the client and the protocols
   * initialization parameters.
   */
  public static async initialize(
    connection: LSP.Connection,
    { rootPath }: LSP.InitializeParams,
  ): Promise<BashServer> {
    const parser = await initializeParser()

    const { PATH } = process.env

    if (!PATH) {
      throw new Error('Expected PATH environment variable to be set')
    }

    return Promise.all([
      Executables.fromPath(PATH),
      Analyzer.fromRoot({ connection, rootPath, parser }),
    ]).then(xs => {
      const executables = xs[0]
      const analyzer = xs[1]
      return new BashServer(connection, executables, analyzer)
    })
  }

  private executables: Executables
  private analyzer: Analyzer

  private documents: LSP.TextDocuments<TextDocument> = new LSP.TextDocuments(TextDocument)
  private connection: LSP.Connection

  private constructor(
    connection: LSP.Connection,
    executables: Executables,
    analyzer: Analyzer,
  ) {
    this.connection = connection
    this.executables = executables
    this.analyzer = analyzer
  }

  /**
   * Register handlers for the events from the Language Server Protocol that we
   * care about.
   */
  public register(connection: LSP.Connection): void {
    // The content of a text document has changed. This event is emitted
    // when the text document first opened or when its content has changed.
    this.documents.listen(this.connection)
    this.documents.onDidChangeContent(change => {
      const { uri } = change.document
      const diagnostics = this.analyzer.analyze(uri, change.document)
      if (config.getHighlightParsingError()) {
        connection.sendDiagnostics({
          uri: change.document.uri,
          diagnostics,
        })
      }
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
      },
      hoverProvider: true,
      documentHighlightProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      referencesProvider: true,
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

  private async onHover(
    params: LSP.TextDocumentPositionParams,
  ): Promise<LSP.Hover | null> {
    const word = this.getWordAtPoint(params)
    const currentUri = params.textDocument.uri

    this.logRequest({ request: 'onHover', params, word })

    if (!word) {
      return null
    }

    const explainshellEndpoint = config.getExplainshellEndpoint()
    if (explainshellEndpoint) {
      this.connection.console.log(`Query ${explainshellEndpoint}`)
      const response = await this.analyzer.getExplainshellDocumentation({
        params,
        endpoint: explainshellEndpoint,
      })

      if (response.status === 'error') {
        this.connection.console.log(
          `getExplainshellDocumentation returned: ${JSON.stringify(response, null, 4)}`,
        )
      } else {
        return {
          contents: {
            kind: 'markdown',
            value: new TurndownService().turndown(response.helpHTML),
          },
        }
      }
    }

    if (
      ReservedWords.isReservedWord(word) ||
      Builtins.isBuiltin(word) ||
      this.executables.isExecutableOnPATH(word)
    ) {
      const shellDocumentation = await getShellDocumentation({ word })
      if (shellDocumentation) {
        // eslint-disable-next-line no-console
        return { contents: getMarkdownContent(shellDocumentation) }
      }
    }

    // FIXME: could also be a symbol

    return null
  }

  private onDefinition(params: LSP.TextDocumentPositionParams): LSP.Definition | null {
    const word = this.getWordAtPoint(params)
    this.logRequest({ request: 'onDefinition', params, word })
    if (!word) {
      return null
    }
    return this.analyzer.findDefinition(word)
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
      return null
    }
    return this.analyzer
      .findOccurrences(params.textDocument.uri, word)
      .map(n => ({ range: n.range }))
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
    const word = this.getWordAtPoint(params)
    this.logRequest({ request: 'onCompletion', params, word })

    const currentUri = params.textDocument.uri

    const symbolCompletions =
      word === null
        ? []
        : getCompletionItemsForSymbols({
            symbols: this.analyzer.findSymbolsMatchingWord({
              word,
            }),
            currentUri,
          })

    const reservedWordsCompletions = ReservedWords.LIST.map(reservedWord => ({
      label: reservedWord,
      kind: LSP.SymbolKind.Interface, // ??
      data: {
        name: reservedWord,
        type: CompletionItemDataType.ReservedWord,
      },
    }))

    const programCompletions = this.executables
      .list()
      .filter(executable => !Builtins.isBuiltin(executable))
      .map(executable => {
        return {
          label: executable,
          kind: LSP.SymbolKind.Function,
          data: {
            name: executable,
            type: CompletionItemDataType.Executable,
          },
        }
      })

    const builtinsCompletions = Builtins.LIST.map(builtin => ({
      label: builtin,
      kind: LSP.SymbolKind.Interface, // ??
      data: {
        name: builtin,
        type: CompletionItemDataType.Builtin,
      },
    }))

    const allCompletions = [
      ...reservedWordsCompletions,
      ...symbolCompletions,
      ...programCompletions,
      ...builtinsCompletions,
    ]

    if (word) {
      if (word.startsWith('#')) {
        // Inside a comment block
        return []
      }

      // Filter to only return suffixes of the current word
      return allCompletions.filter(item => item.label.startsWith(word))
    }

    return allCompletions
  }

  private async onCompletionResolve(
    item: LSP.CompletionItem,
  ): Promise<LSP.CompletionItem> {
    const {
      data: { name, type },
    } = item as BashCompletionItem

    this.connection.console.log(`onCompletionResolve name=${name} type=${type}`)

    const getMarkdownCompletionItem = (doc: string) => ({
      ...item,
      // LSP.MarkupContent
      documentation: {
        value: ['``` man', doc, '```'].join('\n'),
        // Passed as markdown for syntax highlighting
        kind: 'markdown' as const,
      },
    })

    try {
      if (type === CompletionItemDataType.Executable) {
        const doc = await this.executables.documentation(name)
        return getMarkdownCompletionItem(doc)
      } else if (type === CompletionItemDataType.Builtin) {
        const doc = await Builtins.documentation(name)
        return getMarkdownCompletionItem(doc)
      } else if (type === CompletionItemDataType.ReservedWord) {
        const doc = await ReservedWords.documentation(name)
        return getMarkdownCompletionItem(doc)
      } else {
        return item
      }
    } catch (error) {
      return item
    }
  }
}

function getCompletionItemsForSymbols({
  symbols,
  currentUri,
}: {
  symbols: LSP.SymbolInformation[]
  currentUri: string
}): BashCompletionItem[] {
  const isCurrentFile = ({ location: { uri } }: LSP.SymbolInformation) =>
    uri === currentUri

  const getSymbolId = ({ name, kind }: LSP.SymbolInformation) => `${name}${kind}`

  const symbolsCurrentFile = symbols.filter(s => isCurrentFile(s))

  const symbolsOtherFiles = symbols
    .filter(s => !isCurrentFile(s))
    // Remove identical symbols
    .filter(
      symbolOtherFiles =>
        !symbolsCurrentFile.some(
          symbolCurrentFile =>
            getSymbolId(symbolCurrentFile) === getSymbolId(symbolOtherFiles),
        ),
    )

  return uniqueBasedOnHash(
    [...symbolsCurrentFile, ...symbolsOtherFiles],
    getSymbolId,
  ).map((symbol: LSP.SymbolInformation) => ({
    label: symbol.name,
    kind: symbolKindToCompletionKind(symbol.kind),
    data: {
      name: symbol.name,
      type: CompletionItemDataType.Symbol,
    },
    documentation:
      symbol.location.uri !== currentUri
        ? `${symbolKindToDescription(symbol.kind)} defined in ${path.relative(
            currentUri,
            symbol.location.uri,
          )}`
        : undefined,
  }))
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
