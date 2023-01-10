#!/usr/bin/env node
/* eslint-disable no-console */
import * as LSP from 'vscode-languageserver/node'

import BashServer from './server'
import { DEFAULT_LOG_LEVEL, LOG_LEVEL_ENV_VAR } from './util/logger'

const packageJson = require('../package')

const PADDING = 38

const commandsAndFlags = {
  start: 'Start listening on stdin/stdout',
  '-h, --help': 'Display this help and exit',
  '-v, --version': 'Print the version and exit',
} as const

function printHelp() {
  console.log(`Usage:
${Object.entries(commandsAndFlags)
  .map(
    ([k, description]) =>
      `  ${`bash-language-server ${k}`.padEnd(PADDING)} ${description}`,
  )
  .join('\n')}

Environment variables:
  ${LOG_LEVEL_ENV_VAR.padEnd(PADDING)} Set the log level (default: ${DEFAULT_LOG_LEVEL})

Further documentation: ${packageJson.repository.url}`)
}

export function runCli() {
  const args = process.argv.slice(2)

  const start = args.find((s) => s == 'start')
  const version = args.find((s) => s == '-v' || s == '--version')
  const help = args.find((s) => s == '-h' || s == '--help')

  if (start) {
    listen()
  } else if (version) {
    console.log(packageJson.version)
  } else if (help) {
    printHelp()
  } else {
    if (args.length > 0) {
      console.error(`Unknown command '${args.join(' ')}'.`)
    }
    printHelp()
  }
}

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

if (require.main === module) {
  runCli()
}
