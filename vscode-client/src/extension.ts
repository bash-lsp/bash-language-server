'use strict'

import { ExtensionContext, window, workspace } from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient'

import * as Util from './util'

export function activate(context: ExtensionContext) {
  Util.base()
    .then(base => Util.executable(base))
    .then(command => start(context, command))
    .catch(_ => handleMissingExecutable())
}

function start(context: ExtensionContext, command: string) {
  const serverOptions: ServerOptions = {
    run: {
      command,
      args: ['start'],
    },
    debug: {
      command,
      args: ['start'],
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

  const disposable = new LanguageClient(
    'Bash IDE',
    'Bash IDE',
    serverOptions,
    clientOptions,
  ).start()

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(disposable)
}

function handleMissingExecutable() {
  const message = `Can't find bash-langauge-server on your PATH. Please install it using npm i -g bash-language-server.`
  const options = {
    modal: false,
  }

  window.showErrorMessage(message, options)
}
