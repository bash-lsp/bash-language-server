'use strict'

import semverCompare = require('semver-compare')
import { ExtensionContext, window, workspace } from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient'

import { getServerInfo } from './util'

const MINIMUM_SERVER_VERSION = '1.3.0'

export async function activate(context: ExtensionContext) {
  try {
    const { command, version } = await getServerInfo()
    if (semverCompare(version, MINIMUM_SERVER_VERSION) === -1) {
      return handleOutdatedExecutable()
    }

    const explainshellEndpoint = workspace
      .getConfiguration('bashIde')
      .get('explainshellEndpoint', '')

    const highlightParsingErrors = workspace
      .getConfiguration('bashIde')
      .get('highlightParsingErrors', false)

    start(context, command, explainshellEndpoint, highlightParsingErrors)
  } catch (error) {
    handleMissingExecutable()
  }
}

function start(
  context: ExtensionContext,
  command: string,
  explainshellEndpoint: string,
  highlightParsingErrors: boolean,
) {
  const env: any = {
    ...process.env,
    EXPLAINSHELL_ENDPOINT: explainshellEndpoint,
    HIGHLIGHT_PARSING_ERRORS: highlightParsingErrors,
  }

  const serverOptions: ServerOptions = {
    run: {
      command,
      args: ['start'],
      options: {
        env,
      },
    },
    debug: {
      command,
      args: ['start'],
      options: {
        env,
      },
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

function handleOutdatedExecutable() {
  const message = `Outdated bash server. Please upgrade by running "npm i -g bash-language-server".`
  window.showErrorMessage(message, { modal: false })
}

function handleMissingExecutable() {
  const message = `Can't find bash-language-server on your PATH. Please install it using "npm i -g bash-language-server".`
  window.showErrorMessage(message, { modal: false })
}
