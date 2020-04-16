'use strict'

import * as LSP from 'vscode-languageserver'

import BashServer from './server'

const pkg = require('../package')

export function listen() {
  // Create a connection for the server.
  // The connection uses stdin/stdout for communication.
  const connection: LSP.IConnection = LSP.createConnection(
    new LSP.StreamMessageReader(process.stdin),
    new LSP.StreamMessageWriter(process.stdout),
  )

  connection.onInitialize(
    async (params: LSP.InitializeParams): Promise<LSP.InitializeResult> => {
      connection.console.log(`Initialized server v. ${pkg.version} for ${params.rootUri}`)

      const server = await BashServer.initialize(connection, params)

      server.register(connection)

      return {
        capabilities: server.capabilities(),
      }
    },
  )

  connection.listen()
}
