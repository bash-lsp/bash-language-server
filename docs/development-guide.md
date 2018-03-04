# Development guide

**Note:** This is outdated until I figure out how to distribute this extension
in a way that actually works on other peoples computers.

This guide will help you set up your local development environment.

There are two moving parts.

- **Server**: A node server written in Typescript that implements the
  [Language Server Protocol (LSP)][lsp].
- **Client**: A super tiny vscode extension which basically just tells vscode
  how to launch the LSP server.

The project has a root `package.json` file which is really just there for
convenience - it proxies to the `package.json` files in the `vscode-client` and
`server` folders.

To **install all the required dependencies** run

```
npm install
```

This uses the `postinstall` hook to install the dependencies in each of the
sub-projects as well as using [npm link][npm-link] to get your local client to
use your local version of the server.

To **compile everything** run

```
npm run compile
```

Now, as most of the interesting things are happening in the server you'll probably want to
re-compile it whenever you make a change to any of the source files:

```
npm run watch:server
```

Finally Launch the extension using `Launch Client` task from within vscode. For
now you'll have to re-launch the extension whenever you've made any changes to
the source.

[lsp]: https://microsoft.github.io/language-server-protocol/
[node-gyp]: https://github.com/nodejs/node-gyp
[npm-link]: https://docs.npmjs.com/cli/link
