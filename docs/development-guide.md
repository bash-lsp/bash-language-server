# Development guide

There are two moving parts.

- **Server**: A node server written in Typescript that implements the
  [Language Server Protocol (LSP)][lsp].

**Client**: A Visual Studio Code (vscode) extension which wraps the LSP server.

The project has a root `package.json` file which is really just there for
convenience - it proxies to the `package.json` files in the `vscode-client` and
`server` folders.

## Prerequisites

This guide presumes you have the following dependencies installed:

- [`pnpm`][pnpm].
- [`node`][node] (v14 or newer)

## Initial setup

Run the following in the root of the project

```
pnpm install
```

This uses the `postinstall` hook to install the dependencies in each of the
sub-projects.

To make sure that everything is configured correctly run the following command
to compile both the client and the server once

```
pnpm compile
```

Now, depending on which part you want to work on follow the relevant section
below.

## Development Tools

To support a good develop workflow we set up [eslint][eslint], [Prettier][prettier] and integration tests using [Jest][jest]:

    pnpm verify  # (runs lint, prettier and tests)
    pnpm lint
    pnpm test
    pnpm test:coverage

## Working on the client

### Visual Studio Code

Working on the client is simply a matter of starting vscode and using the Debug
View to launch the `Launch Client` task. This will open a new vscode window with the
extension loaded. It also looks for changes to your client code and recompiles
it whenever you save your changes.

### Atom

See the [ide-bash][ide-bash] package for Atom. Due to how Atom packages are
published the client lives in a separate repository.

## Working on the server (VS Code)

As the server is embedded into the VS Code client, you can link any server
changes into the local installation of your VS Code client by running this once:

```
pnpm link-server
```

After that follow the steps above to work on the client.

## Working on the server (standalone)

If you are working on the server outside of VS Code, then simply compile
and install the server globally whenever you've made a change, and then
reload your vscode window to re-launch the server.

```
pnpm reinstall-server
```

If you for some reason cannot get access to logs through the client,
then you can hack the `server/util/logger` with:

```typescript
const fs = require('fs')
const util = require('util')
const log_file = fs.createWriteStream(`/tmp/bash-language-server-debug.log`, {
  flags: 'w',
})

// inside log function
log_file.write(`${severity} ${util.format(message)}\n`)
```

## Performance

To analyze the performance of the extension or server using the Chrome inspector:

1. In Code start debugging "Run -> Start debugging"
2. Open `chrome://inspect` in Chrome and ensure the port `localhost:6009` is added

[lsp]: https://microsoft.github.io/language-server-protocol/
[ide-bash]: https://github.com/bash-lsp/ide-bash
[jest]: https://facebook.github.io/jest/
[prettier]: https://prettier.io/
[eslint]: https://eslint.org/
[pnpm]: https://pnpm.io/installation
[node]: https://nodejs.org/en/download/
