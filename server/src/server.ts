import * as LSP from 'vscode-languageserver'

import { Analyzer } from './analyser'
import { Executables } from './executables'

/**
 * The BashServer glues together the separate components to implement
 * the various parts of the Language Server Protocol.
 */
export class BashServer {
  /**
   * Initialize the server based on a connection to the client and the protocols
   * initialization paramters.
   */
  public static initialize(
    connection: LSP.Connection,
    params: LSP.InitializeParams,
  ): Promise<BashServer> {
    return Promise.all([
      Executables.fromPath(process.env.PATH),
      Analyzer.fromRoot(connection, params.rootPath),
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
      const contents = change.document.getText()
      const diagnostics = this.analyzer.analyze(uri, contents)
      connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics,
      })
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

  private onHover(pos: LSP.TextDocumentPositionParams): Promise<LSP.Hover> {
    this.connection.console.log(
      `Hovering over ${pos.position.line}:${pos.position.character}`,
    )

    const word = this.analyzer.wordAtPoint(
      pos.textDocument.uri,
      pos.position.line,
      pos.position.character,
    )

    return this.executables.isExecutableOnPATH(word)
      ? this.executables.documentation(word).then(doc => ({
          contents: {
            language: 'plaintext',
            value: doc,
          },
        }))
      : null
  }

  private onDefinition(pos: LSP.TextDocumentPositionParams): LSP.Definition {
    this.connection.console.log(
      `Asked for definition at ${pos.position.line}:${pos.position.character}`,
    )
    const word = this.analyzer.wordAtPoint(
      pos.textDocument.uri,
      pos.position.line,
      pos.position.character,
    )
    return this.analyzer.findDefinition(word)
  }

  private onDocumentSymbol(params: LSP.DocumentSymbolParams): LSP.SymbolInformation[] {
    return this.analyzer.findSymbols(params.textDocument.uri)
  }

  private onDocumentHighlight(
    pos: LSP.TextDocumentPositionParams,
  ): LSP.DocumentHighlight[] {
    const word = this.analyzer.wordAtPoint(
      pos.textDocument.uri,
      pos.position.line,
      pos.position.character,
    )
    return this.analyzer
      .findOccurrences(pos.textDocument.uri, word)
      .map(n => ({ range: n.range }))
  }

  private onReferences(params: LSP.ReferenceParams): LSP.Location[] {
    const word = this.analyzer.wordAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character,
    )
    return this.analyzer.findReferences(word)
  }

  private onCompletion(pos: LSP.TextDocumentPositionParams): LSP.CompletionItem[] {
    this.connection.console.log(
      `Asked for completions at ${pos.position.line}:${pos.position.character}`,
    )
    const symbols = this.analyzer.findSymbols(pos.textDocument.uri)

    const symbolCompletions = symbols.map((s: LSP.SymbolInformation) => {
      return {
        label: s.name,
        kind: s.kind,
        data: {
          name: s.name,
          type: 'function',
        },
      }
    })

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

    return symbolCompletions.concat(programCompletions)
  }

  private onCompletionResolve(item: LSP.CompletionItem): Promise<LSP.CompletionItem> {
    if (item.data.type === 'executable') {
      return this.executables
        .documentation(item.data.name)
        .then(doc => ({
          ...item,
          detail: doc,
        }))
        .catch(() => item)
    } else {
      return Promise.resolve(item)
    }
  }
}
