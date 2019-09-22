'use strict'
import * as path from 'path'

import { ExtensionContext, workspace } from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient'

export async function activate(context: ExtensionContext) {
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

  const serverExecutable = {
    module: context.asAbsolutePath(path.join('out', 'src', 'server.js')),
    transport: TransportKind.ipc,
    options: {
      env,
    },
  }

  const serverOptions: ServerOptions = {
    run: serverExecutable,
    debug: serverExecutable,
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

  const client = new LanguageClient('Bash IDE', 'Bash IDE', serverOptions, clientOptions)

  // client.registerProposedFeatures();

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(client.start())
}
