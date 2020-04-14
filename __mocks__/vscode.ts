/* eslint-disable @typescript-eslint/no-empty-function */
const languages = {
  createDiagnosticCollection: jest.fn(),
  registerCodeLensProvider: jest.fn(),
}

const StatusBarAlignment = { Left: 1, Right: 2 }

const window = {
  createStatusBarItem: jest.fn(() => ({
    show: jest.fn(),
    tooltip: jest.fn(),
  })),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  createTextEditorDecorationType: jest.fn(),
  createOutputChannel: jest.fn(),
  showWorkspaceFolderPick: jest.fn(),
  onDidChangeActiveTextEditor: jest.fn(),
  showInformationMessage: jest.fn(),
}

const workspace = {
  createFileSystemWatcher: jest.fn(),
  getConfiguration: jest.fn(() => ({ get: jest.fn })),
  getWorkspaceFolder: jest.fn(),
  workspaceFolders: [],

  onDidChangeConfiguration: jest.fn(),
  onDidChangeTextDocument: jest.fn(),
  onDidChangeWorkspaceFolders: jest.fn(),
}

const OverviewRulerLane = {
  Left: null,
}

const Uri = {
  file: (f: string) => f,
  parse: jest.fn(),
}
const Range = jest.fn()
const Diagnostic = jest.fn()
const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 }

const debug = {
  onDidTerminateDebugSession: jest.fn(),
  startDebugging: jest.fn(),
  registerDebugConfigurationProvider: jest.fn(),
}

const commands = {
  executeCommand: jest.fn(),
  registerCommand: jest.fn(),
}

const CodeLens = function CodeLens() {}

class CompletionItem {}

class DocumentLink {}

module.exports = {
  CodeLens,
  CompletionItem,
  CodeActionKind: {},
  OutputChannel: {
    appendLine: jest.fn(),
  },
  DocumentLink,
  languages,
  StatusBarAlignment,
  window,
  workspace,
  OverviewRulerLane,
  Uri,
  Range,
  Diagnostic,
  DiagnosticSeverity,
  debug,
  commands,
}

const _global = global as any
_global.vscode = module.exports
