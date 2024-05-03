'use strict'

import * as path from 'path'
import { ExtensionContext, workspace } from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'

let client: LanguageClient

export const CONFIGURATION_SECTION = 'bashIde' // matching the package.json configuration section

export async function activate(context: ExtensionContext) {
  const config = workspace.getConfiguration(CONFIGURATION_SECTION)
  const env: any = {
    ...process.env,
    BASH_IDE_LOG_LEVEL: config.get('logLevel', ''),
  }

  const serverExecutable = {
    module: context.asAbsolutePath(path.join('out', 'server.js')),
    transport: TransportKind.ipc,
    options: {
      env,
    },
  }

  const debugServerExecutable = {
    ...serverExecutable,
    options: {
      ...serverExecutable.options,
      execArgv: ['--nolazy', '--inspect=6009'],
    },
  }

  const serverOptions: ServerOptions = {
    run: serverExecutable,
    debug: debugServerExecutable,
  }

  // NOTE: To debug a server running in a process, use the following instead:
  // This requires the server to be globally installed.
  // const serverOptions = {
  //   command: 'bash-language-server',
  //   args: ['start'],
  // }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        scheme: 'file',
        language: 'shellscript',
      },
    ],
    synchronize: {
      configurationSection: CONFIGURATION_SECTION,
    },
  }

  const client = new LanguageClient('Bash IDE', 'Bash IDE', serverOptions, clientOptions)
  client.registerProposedFeatures()

  try {
    await client.start()
  } catch (error) {
    client.error(`Start failed`, error, 'force')
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  return client.stop()
}
