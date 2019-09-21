import * as LSP from 'vscode-languageserver'

import * as TurndownService from 'turndown'
import Analyzer from './analyser'
import * as Builtins from './builtins'
import * as config from './config'
import Executables from './executables'
import { initializeParser } from './parser'

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

    return Promise.all([
      Executables.fromPath(process.env.PATH),
      Analyzer.fromRoot({ connection, rootPath, parser }),
    ]).then(xs => {
      const executables = xs[0]
      const analyzer = xs[1]
      return new BashServer(connection, executables, analyzer)
    })
  }

  private executables: Executables
  private analyzer: Analyzer

  private documents: LSP.TextDocuments = new LSP.TextDocuments()
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
      const uri = change.document.uri
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
      textDocumentSync: this.documents.syncKind,
      completionProvider: {
        resolveProvider: true,
      },
      hoverProvider: true,
      documentHighlightProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
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

  private async onHover(pos: LSP.TextDocumentPositionParams): Promise<LSP.Hover> {
    this.connection.console.log(
      `Hovering over ${pos.position.line}:${pos.position.character}`,
    )

    const word = this.getWordAtPoint(pos)
    const explainshellEndpoint = config.getExplainshellEndpoint()
    if (explainshellEndpoint) {
      this.connection.console.log(`Query ${explainshellEndpoint}`)
      const response = await this.analyzer.getExplainshellDocumentation({
        pos,
        endpoint: explainshellEndpoint,
      })

      if (response.status === 'error') {
        this.connection.console.log(
          'getExplainshellDocumentation returned: ' + JSON.stringify(response, null, 4),
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

    if (Builtins.isBuiltin(word)) {
      return Builtins.documentation(word).then(doc => ({
        contents: {
          language: 'plaintext',
          value: doc,
        },
      }))
    }

    if (this.executables.isExecutableOnPATH(word)) {
      return this.executables.documentation(word).then(doc => ({
        contents: {
          language: 'plaintext',
          value: doc,
        },
      }))
    }

    return null
  }

  private onDefinition(pos: LSP.TextDocumentPositionParams): LSP.Definition {
    this.connection.console.log(
      `Asked for definition at ${pos.position.line}:${pos.position.character}`,
    )
    const word = this.getWordAtPoint(pos)
    return this.analyzer.findDefinition(word)
  }

  private onDocumentSymbol(params: LSP.DocumentSymbolParams): LSP.SymbolInformation[] {
    return this.analyzer.findSymbols(params.textDocument.uri)
  }

  private onDocumentHighlight(
    pos: LSP.TextDocumentPositionParams,
  ): LSP.DocumentHighlight[] {
    const word = this.getWordAtPoint(pos)
    return this.analyzer
      .findOccurrences(pos.textDocument.uri, word)
      .map(n => ({ range: n.range }))
  }

  private onReferences(params: LSP.ReferenceParams): LSP.Location[] {
    const word = this.getWordAtPoint(params)
    return this.analyzer.findReferences(word)
  }

  private onCompletion(pos: LSP.TextDocumentPositionParams): LSP.CompletionItem[] {
    this.connection.console.log(
      `Asked for completions at ${pos.position.line}:${pos.position.character}`,
    )
    const symbolCompletions = this.analyzer.findSymbolCompletions(pos.textDocument.uri)

    const programCompletions = this.executables.list().map((s: string) => {
      return {
        label: s,
        kind: LSP.SymbolKind.Function,
        data: {
          name: s,
          type: 'executable',
        },
      }
    })

    const builtinsCompletions = Builtins.LIST.map(builtin => ({
      label: builtin,
      kind: LSP.SymbolKind.Method, // ??
      data: {
        name: builtin,
        type: 'builtin',
      },
    }))

    return [...symbolCompletions, ...programCompletions, ...builtinsCompletions]
  }

  private async onCompletionResolve(
    item: LSP.CompletionItem,
  ): Promise<LSP.CompletionItem> {
    const { data: { name, type } } = item
    try {
      if (type === 'executable') {
        const doc = await this.executables.documentation(name)
        return {
          ...item,
          detail: doc,
        }
      } else if (type === 'builtin') {
        const doc = await Builtins.documentation(name)
        return {
          ...item,
          detail: doc,
        }
      } else {
        return item
      }
    } catch (error) {
      return item
    }
  }
}
