import {
  createConnection,
  IConnection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
} from 'vscode-languageserver'

import BashLanguageServer from 'bash-language-server'

const connection: IConnection = createConnection(ProposedFeatures.all)

connection.onInitialize(
  async (params: InitializeParams): Promise<InitializeResult> => {
    connection.console.info('Initializing Bash LSP server...')

    connection.console.info('Rebuild succeeded')

    const server = await BashLanguageServer.initialize(connection, params)

    connection.console.info('BashLanguageServer initialized, registering connection')

    server.register(connection)

    connection.console.info(
      `BashLanguageServer initialized ${JSON.stringify(server.capabilities())}`,
    )

    return {
      capabilities: server.capabilities(),
    }
  },
)

// Listen on the connection
connection.listen()

// Don't die on unhandled Promise rejections
process.on('unhandledRejection', (reason, p) => {
  connection.console.error(`Unhandled Rejection at promise: ${p}, reason: ${reason}`)
})

process.on('SIGPIPE', () => {
  // Don't die when attempting to pipe stdin to a bad spawn
  // https://github.com/electron/electron/issues/13254
})
