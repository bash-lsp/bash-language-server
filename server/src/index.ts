// TODO: combine this with server/bin as this is only used for that. Rename to bin.ts
'use strict'

import * as LSP from 'vscode-languageserver/node'

import BashServer from './server'

export function listen() {
  // Create a connection for the server.
  // The connection uses stdin/stdout for communication.
  const connection = LSP.createConnection(
    new LSP.StreamMessageReader(process.stdin),
    new LSP.StreamMessageWriter(process.stdout),
  )

  connection.onInitialize(
    async (params: LSP.InitializeParams): Promise<LSP.InitializeResult> => {
      const server = await BashServer.initialize(connection, params)
      server.register(connection)
      return {
        capabilities: server.capabilities(),
      }
    },
  )

  connection.listen()
}
