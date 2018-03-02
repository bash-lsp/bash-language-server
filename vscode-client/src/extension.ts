'use strict';

import * as path from 'path';

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {

	const serverModule = context.asAbsolutePath(path.join(
    'node_modules',
    'bash-language-server',
    'out',
    'server.js'
  ));

	let serverOptions: ServerOptions = {
		run : {
      command: "node",
      args: [serverModule]
    },
		debug: {
      command: "node",
      args: [serverModule]
    }
	}

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{
      scheme: 'file',
      language: 'shellscript'
    }],
		synchronize: {
			configurationSection: 'Bash IDE',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}

	let disposable = new LanguageClient('Bash IDE', 'Bash IDE', serverOptions, clientOptions).start();

	// Push the disposable to the context's subscriptions so that the
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);
}
