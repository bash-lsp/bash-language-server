import * as lsp from 'vscode-languageserver'

import { FIXTURE_FOLDER, FIXTURE_URI } from '../../../testing/fixtures'
import LspServer from '../server'

async function initializeServer() {
  const diagnostics: Array<lsp.PublishDiagnosticsParams | undefined> = undefined
  const console: any = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
  }

  const connection: jest.Mocked<lsp.Connection> = {
    client: {} as any,
    console,
    dispose: jest.fn(),
    listen: jest.fn(),
    onCodeAction: jest.fn(),
    onCodeLens: jest.fn(),
    onCodeLensResolve: jest.fn(),
    onColorPresentation: jest.fn(),
    onCompletion: jest.fn(),
    onCompletionResolve: jest.fn(),
    onDeclaration: jest.fn(),
    onDefinition: jest.fn(),
    onDidChangeConfiguration: jest.fn(),
    onDidChangeTextDocument: jest.fn(),
    onDidChangeWatchedFiles: jest.fn(),
    onDidCloseTextDocument: jest.fn(),
    onDidOpenTextDocument: jest.fn(),
    onDidSaveTextDocument: jest.fn(),
    onDocumentColor: jest.fn(),
    onDocumentFormatting: jest.fn(),
    onDocumentHighlight: jest.fn(),
    onDocumentLinkResolve: jest.fn(),
    onDocumentLinks: jest.fn(),
    onDocumentOnTypeFormatting: jest.fn(),
    onDocumentRangeFormatting: jest.fn(),
    onDocumentSymbol: jest.fn(),
    onExecuteCommand: jest.fn(),
    onExit: jest.fn(),
    onFoldingRanges: jest.fn(),
    onHover: jest.fn(),
    onImplementation: jest.fn(),
    onInitialize: jest.fn(),
    onInitialized: jest.fn(),
    onNotification: jest.fn(),
    onPrepareRename: jest.fn(),
    onReferences: jest.fn(),
    onRenameRequest: jest.fn(),
    onRequest: jest.fn(),
    onShutdown: jest.fn(),
    onSignatureHelp: jest.fn(),
    onTypeDefinition: jest.fn(),
    onWillSaveTextDocument: jest.fn(),
    onWillSaveTextDocumentWaitUntil: jest.fn(),
    onWorkspaceSymbol: jest.fn(),
    sendDiagnostics: jest.fn(),
    sendNotification: jest.fn(),
    sendRequest: jest.fn(),
    telemetry: {} as any,
    tracer: {} as any,
    window: {} as any,
    workspace: {} as any,
  }

  const server = await LspServer.initialize(connection, {
    rootPath: FIXTURE_FOLDER,
    rootUri: undefined,
    processId: 42,
    capabilities: {} as any,
    workspaceFolders: null,
  })

  return {
    connection,
    console,
    diagnostics,
    server,
  }
}

describe('server', () => {
  it('initializes and responds to capabilities', async () => {
    const { server } = await initializeServer()
    expect(server.capabilities()).toMatchSnapshot()
  })

  it('register LSP connection', async () => {
    const { connection, server } = await initializeServer()

    server.register(connection)

    expect(connection.onHover).toHaveBeenCalledTimes(1)
    expect(connection.onDefinition).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentHighlight).toHaveBeenCalledTimes(1)
    expect(connection.onReferences).toHaveBeenCalledTimes(1)
    expect(connection.onCompletion).toHaveBeenCalledTimes(1)
    expect(connection.onCompletionResolve).toHaveBeenCalledTimes(1)
  })

  it('responds to onHover', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onHover = connection.onHover.mock.calls[0][0]

    const result = await onHover(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          line: 25,
          character: 5,
        },
      },
      {} as any,
    )

    expect(result).toBeDefined()
    expect(result).toEqual({
      contents: {
        kind: 'markdown',
        value: expect.stringContaining('RM(1)'),
      },
    })
  })

  it('responds to onCompletion with filtered list when word is found', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          // rm
          line: 25,
          character: 5,
        },
      },
      {} as any,
    )

    // Limited set
    expect('length' in result && result.length < 5).toBe(true)
    expect(result).toEqual(
      expect.arrayContaining([
        {
          data: {
            name: 'rm',
            type: 'executable',
          },
          kind: expect.any(Number),
          label: 'rm',
        },
      ]),
    )
  })

  it('responds to onCompletion with entire list when no word is found', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          // else
          line: 24,
          character: 5,
        },
      },
      {} as any,
    )

    // Entire list
    expect('length' in result && result.length > 50).toBe(true)
  })

  it('responds to onCompletion with empty list when word is a comment', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          // inside comment
          line: 2,
          character: 1,
        },
      },
      {} as any,
    )

    expect(result).toEqual([])
  })
})
