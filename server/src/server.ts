'use strict';

import {
  createConnection,
  IConnection,
  TextDocuments,
  InitializeResult,
  TextDocumentPositionParams,
  CompletionItem,
	Definition,
  StreamMessageReader,
  StreamMessageWriter,
  SymbolInformation,
  DocumentSymbolParams,
  Location,
  DocumentHighlight,
  ReferenceParams} from 'vscode-languageserver';

import * as Analyser from './analyser';

// Create a connection for the server.
// The connection uses stdin/stdout for communication.
const connection: IConnection = createConnection(
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout)
);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments = new TextDocuments();

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

connection.onInitialize((params): InitializeResult => {
  connection.console.log(`Initialized for ${params.rootUri}, ${params.rootPath}`)

	return {
		capabilities: {
			// For now we're using full-sync even though tree-sitter has great support
			// for partial updates.
			textDocumentSync: documents.syncKind,
			completionProvider: {
				resolveProvider: true
      },
      documentHighlightProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      referencesProvider: true
		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  connection.console.log('Invoked onDidChangeContent');
  const diagnostics = Analyser.analyze(change.document)
  connection.sendDiagnostics({
    uri: change.document.uri,
    diagnostics
  })
});

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

connection.onDefinition((textDocumentPosition: TextDocumentPositionParams): Definition => {
  connection.console.log(`Asked for definition at ${textDocumentPosition.position.line}:${textDocumentPosition.position.character}`);
  const word = Analyser.wordAtPoint(
    textDocumentPosition.textDocument.uri,
    textDocumentPosition.position.line,
    textDocumentPosition.position.character
  )
  return Analyser.findDefinition(
    textDocumentPosition.textDocument.uri,
    word
  );
});

connection.onDocumentSymbol((params: DocumentSymbolParams): SymbolInformation[] => {
  return Analyser.findSymbols(params.textDocument.uri)
})

connection.onDocumentHighlight((textDocumentPosition: TextDocumentPositionParams): DocumentHighlight[] => {
  const word = Analyser.wordAtPoint(
    textDocumentPosition.textDocument.uri,
    textDocumentPosition.position.line,
    textDocumentPosition.position.character
  )

  connection.console.log(`Asked for highlight for ${word}`);

  const locs = Analyser.findOccurrences(textDocumentPosition.textDocument.uri, word)

  connection.console.log(`Found ${locs.length} occurrences`);

  return locs.map(n => ({range: n.range}))
})

connection.onReferences((params: ReferenceParams): Location[] => {
  const word = Analyser.wordAtPoint(
    params.textDocument.uri,
    params.position.line,
    params.position.character
  )

  connection.console.log(`Asked for references to ${word}`);

  const locs = Analyser.findOccurrences(params.textDocument.uri, word)

  connection.console.log(`Found ${locs.length} occurrences`);

  return locs
})

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  connection.console.log(`Asked for completions at ${textDocumentPosition.position.line}:${textDocumentPosition.position.character}`);
  const symbols = Analyser.findSymbols(textDocumentPosition.textDocument.uri)
  return symbols.map((s: SymbolInformation) => {
    return {
			label: s.name,
			kind: s.kind,
      data: s.name // Used for later resolving more info.
    }
  })
});

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

	return item;
});

/*
connection.onDidSaveTextDocument((params) => {
  connection.console.log(`You saved the document ${params}`)
})

connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});

connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/
// Listen on the connection
connection.listen();
