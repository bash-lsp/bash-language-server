'use strict'

import * as path from 'path'

import { ExtensionContext, workspace } from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient'

let client: LanguageClient

export async function activate(context: ExtensionContext) {
  // FIXME: do we need this?
  const serverModule = context.asAbsolutePath(
    path.join('node_modules', 'bash-language-server', 'bin', 'main.js'),
  )

  /*
  const explainshellEndpoint = workspace
    .getConfiguration('bashIde')
    .get('explainshellEndpoint', '')

  const highlightParsingErrors = workspace
    .getConfiguration('bashIde')
    .get('highlightParsingErrors', false)

  const env: any = {
    ...process.env,
    EXPLAINSHELL_ENDPOINT: explainshellEndpoint,
    HIGHLIGHT_PARSING_ERRORS: highlightParsingErrors,
  }
  */

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
      // options: { env, execArgv: ['start'] },
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      // options: { env, execArgv: ['start --inspect=6009'] },
    },
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        scheme: 'file',
        language: 'shellscript',
      },
    ],
    synchronize: {
      configurationSection: 'Bash IDE',
      // Notify the server about file changes to '.clientrc files contain in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc'),
    },
  }

  client = new LanguageClient('Bash IDE', 'Bash IDE', serverOptions, clientOptions)

  client.start()

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  // context.subscriptions.push(client)

  /*
  // FIXME: or
  export function deactivate(): Thenable<void> {
    if (!client) {
      return undefined;
    }
    return client.stop();
  }
  */
}

export function deactivate(): Thenable<void> {
  if (!client) {
    return Promise.resolve()
  }
  return client.stop()
}
