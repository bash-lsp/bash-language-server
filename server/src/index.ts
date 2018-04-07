'use strict'

import * as LSP from 'vscode-languageserver'

import BashServer from './server'

// tslint:disable-next-line:no-var-requires
const pkg = require('../package')

export function listen() {
  // Create a connection for the server.
  // The connection uses stdin/stdout for communication.
  const connection: LSP.IConnection = LSP.createConnection(
    new LSP.StreamMessageReader(process.stdin),
    new LSP.StreamMessageWriter(process.stdout),
  )

  connection.onInitialize((params: LSP.InitializeParams): Promise<
    LSP.InitializeResult
  > => {
    connection.console.log(`Initialized server v. ${pkg.version} for ${params.rootUri}`)

    return BashServer.initialize(connection, params)
      .then(server => {
        server.register(connection)
        return server
      })
      .then(server => ({
        capabilities: server.capabilities(),
      }))
  })

  connection.listen()
}
