import {
  createConnection,
  IConnection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
} from 'vscode-languageserver'

import { NodeRuntime, rebuildTreeSitter } from './rebuilder'

const connection: IConnection = createConnection(ProposedFeatures.all)

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  connection.console.info('Initializing Bash LSP server...')

  const nodeRuntime = params.initializationOptions
    ? params.initializationOptions.runtime
    : NodeRuntime.Electron
  connection.console.info(
    `Rebuilding tree-sitter for local ${
      nodeRuntime === NodeRuntime.Electron ? 'Electron' : 'Node.js'
    } version`,
  )
  const rebuildResult: [void | Error, void | Error] = await rebuildTreeSitter(nodeRuntime)
  for (const result of rebuildResult) {
    if (result) {
      connection.console.error('Rebuild failed!')
      connection.console.error(result.toString())

      // FIXME: should we throw?
      throw new Error('Could not rebuild tree sitter')
    }
  }

  connection.console.info('Rebuild succeeded')

  const BashServer = await import('bash-language-server/out/server')

  const server = await BashServer.default.initialize(connection, params)

  connection.console.info('BashServer initialized, registering connection')

  server.register(connection)

  connection.console.info('BashServer initialized '+ JSON.stringify(server.capabilities()))

  return server.capabilities()

  // FIXME: try to do this sync...
})

connection.onInitialized(() => {
  connection.console.info('client.server onInitialized')
  // server.registerInitializedProviders()
})

// Listen on the connection
connection.listen()

// Don't die on unhandled Promise rejections
process.on('unhandledRejection', (reason, p) => {
  connection.console.error(`Unhandled Rejection at promise: ${p}, reason: ${reason}`)
})

// Don't die when attempting to pipe stdin to a bad spawn
// https://github.com/electron/electron/issues/13254
process.on('SIGPIPE', () => {})
