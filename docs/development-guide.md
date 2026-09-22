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

- [`pnpm`][pnpm] (use the version pinned in the root and client `package.json` files).
- [`node`][node] (v22.12 or newer for development; the server supports v20 or newer)

If you use nvm, select Node.js 22 (matching CI) from the project root:

```
nvm use
```

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

Development uses [Oxlint][oxlint], [Prettier][prettier], and integration tests using [Vitest][vitest]:

    pnpm verify       # fixes lint/formatting, compiles, type-checks, and runs tests
    pnpm verify:bail  # checks lint/formatting, compiles, and runs tests with coverage
    pnpm lint         # fixes lint and formatting, and checks types
    pnpm lint:bail    # checks lint, formatting, and types without rewriting files
    pnpm test
    pnpm test:coverage
    pnpm test:watch

Run a specific test file or filter by test name:

```sh
pnpm test server/src/__tests__/input-declarations.test.ts
pnpm test server/src/__tests__/server.test.ts -t 'rename'
```

The lint commands run [type-aware rules and TypeScript compiler diagnostics
through Oxlint][oxlint-types]. Test commands run Vitest without repeating lint or
type checks. `pnpm compile` and `pnpm watch` still use `tsc` to emit JavaScript and
declarations.

Tests and test helpers are type-checked using `tsconfig.test.json`. Vitest runs
files sequentially so subprocess and filesystem integration tests stay isolated.
Coverage reports are written to `coverage/` in HTML and LCOV formats.

Install the recommended Oxc VS Code extension for lint diagnostics and fixes on
save. Prettier runs separately as part of the lint commands. The former custom
import and class-member ordering rules are no longer enforced.

## Working on the client

The extension requires VS Code 1.91 or newer, whose bundled Node.js runtime meets
the server's Node.js 20 requirement.

The client installs independently from the workspace. When updating its bundled
server, update both `vscode-client/package.json` and `vscode-client/pnpm-lock.yaml`.
Keep the wrapper's `vscode-languageserver` dependency matched to the bundled server;
`pnpm link-server` links both together when using the local development server.
Each workspace's pnpm settings live in its own `pnpm-workspace.yaml`.
If dependency overrides are needed, keep npm and pnpm overrides aligned: pnpm
uses them for installation, and VSCE uses npm to inspect dependencies when
packaging. Remove each override when the bundled server includes the
corresponding dependency update.

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
[vitest]: https://vitest.dev/
[prettier]: https://prettier.io/
[oxlint]: https://oxc.rs/docs/guide/usage/linter/
[oxlint-types]: https://oxc.rs/docs/guide/usage/linter/type-aware.html
[pnpm]: https://pnpm.io/installation
[node]: https://nodejs.org/en/download/
