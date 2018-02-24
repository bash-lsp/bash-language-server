'use strict';

import {
  createConnection,
  IConnection,
  TextDocuments,
  InitializeResult,
  TextDocumentPositionParams,
  CompletionItem,
	CompletionItemKind,
  Definition,
  StreamMessageReader,
  StreamMessageWriter
} from 'vscode-languageserver';

import * as Analyser from './analyser';

// Create a connection for the server. The connection uses stdin/stdout for
// communication.
let connection: IConnection = createConnection(
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout)
);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities.
connection.onInitialize((_params): InitializeResult => {
	// workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			completionProvider: {
				resolveProvider: true
      },
      definitionProvider: true
		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  // validateTextDocument(change.document);
  connection.console.log('Invoked onDidChangeContent');
  Analyser.analyze(change.document);
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

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	// The pass parameter contains the position of the text document in
	// which code complete got requested. For the example we ignore this
	// info and always provide the same completion items.
	return [
		{
			label: 'TypeScript',
			kind: CompletionItemKind.Text,
			data: 1
		},
		{
			label: 'JavaScript',
			kind: CompletionItemKind.Text,
			data: 2
		}
	]
});

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	if (item.data === 1) {
		item.detail = 'TypeScript details',
			item.documentation = 'TypeScript documentation'
	} else if (item.data === 2) {
		item.detail = 'JavaScript details',
			item.documentation = 'JavaScript documentation'
	}
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
