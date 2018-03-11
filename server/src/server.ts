'use strict'
// tslint:disable:no-var-requires

import {
  CompletionItem,
  createConnection,
  Definition,
  DocumentHighlight,
  DocumentSymbolParams,
  IConnection,
  InitializeResult,
  Location,
  ReferenceParams,
  StreamMessageReader,
  StreamMessageWriter,
  SymbolInformation,
  TextDocumentPositionParams,
  TextDocuments,
} from 'vscode-languageserver'

const glob = require('glob')
const fs = require('fs')
import * as Path from 'path'

const pkg = require('../package')
import * as Analyser from './analyser'

export function listen() {
  // Create a connection for the server.
  // The connection uses stdin/stdout for communication.
  const connection: IConnection = createConnection(
    new StreamMessageReader(process.stdin),
    new StreamMessageWriter(process.stdout),
  )

  // Create a simple text document manager. The text document manager
  // supports full document sync only
  const documents: TextDocuments = new TextDocuments()

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection)

  connection.onInitialize((params): InitializeResult => {
    connection.console.log(`Initialized server v. ${pkg.version} for ${params.rootUri}`)

    if (params.rootPath) {
      glob('**/*.sh', { cwd: params.rootPath }, (err, paths) => {
        if (err != null) {
          connection.console.error(err)
        } else {
          paths.forEach(p => {
            const absolute = Path.join(params.rootPath, p)
            const uri = 'file://' + absolute
            connection.console.log('Analyzing ' + uri)
            Analyser.analyze(uri, fs.readFileSync(absolute, 'utf8'))
          })
        }
      })
    }

    return {
      capabilities: {
        // For now we're using full-sync even though tree-sitter has great support
        // for partial updates.
        textDocumentSync: documents.syncKind,
        completionProvider: {
          resolveProvider: true,
        },
        documentHighlightProvider: true,
        definitionProvider: true,
        documentSymbolProvider: true,
        referencesProvider: true,
      },
    }
  })

  // The content of a text document has changed. This event is emitted
  // when the text document first opened or when its content has changed.
  documents.onDidChangeContent(change => {
    connection.console.log('Invoked onDidChangeContent')
    const uri = change.document.uri
    const contents = change.document.getText()
    const diagnostics = Analyser.analyze(uri, contents)
    connection.sendDiagnostics({
      uri: change.document.uri,
      diagnostics,
    })
  })

  connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event')
  })

  connection.onDefinition(
    (textDocumentPosition: TextDocumentPositionParams): Definition => {
      connection.console.log(
        `Asked for definition at ${textDocumentPosition.position.line}:${
          textDocumentPosition.position.character
        }`,
      )
      const word = Analyser.wordAtPoint(
        textDocumentPosition.textDocument.uri,
        textDocumentPosition.position.line,
        textDocumentPosition.position.character,
      )
      return Analyser.findDefinition(word)
    },
  )

  connection.onDocumentSymbol((params: DocumentSymbolParams): SymbolInformation[] => {
    return Analyser.findSymbols(params.textDocument.uri)
  })

  connection.onDocumentHighlight(
    (textDocumentPosition: TextDocumentPositionParams): DocumentHighlight[] => {
      const word = Analyser.wordAtPoint(
        textDocumentPosition.textDocument.uri,
        textDocumentPosition.position.line,
        textDocumentPosition.position.character,
      )
      return Analyser.findOccurrences(textDocumentPosition.textDocument.uri, word).map(
        n => ({ range: n.range }),
      )
    },
  )

  connection.onReferences((params: ReferenceParams): Location[] => {
    const word = Analyser.wordAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character,
    )
    return Analyser.findReferences(word)
  })

  connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
      connection.console.log(
        `Asked for completions at ${textDocumentPosition.position.line}:${
          textDocumentPosition.position.character
        }`,
      )
      const symbols = Analyser.findSymbols(textDocumentPosition.textDocument.uri)
      return symbols.map((s: SymbolInformation) => {
        return {
          label: s.name,
          kind: s.kind,
          data: s.name, // Used for later resolving more info.
        }
      })
    },
  )

  // This handler resolve additional information for the item selected in
  // the completion list.
  connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    // TODO: Look up man pages for commands
    // TODO: For builtins look up the docs.
    // TODO: For functions, parse their comments?

    // if (item.data === 1) {
    // 	item.detail = 'TypeScript details',
    // 	item.documentation = 'TypeScript documentation'
    // }

    return item
  })

  // Listen on the connection
  connection.listen()
}
