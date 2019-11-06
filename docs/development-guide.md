# Development guide

There are two moving parts.

- **Server**: A node server written in Typescript that implements the
  [Language Server Protocol (LSP)][LSP].

**Client**: A Visual Studio Code (vscode) extension which wraps the LSP server.

The project has a root `package.json` file which is really just there for
convenience - it proxies to the `package.json` files in the `vscode-client` and
`server` folders.

## Prerequisites

This guide presumes you have the following dependencies installed:

- [`yarn`][yarn].
- [`node`][node] (v6 or newer)
- `g++`
- `make`

## Initial setup

Run the following in the root of the project

```
yarn install
```

This uses the `postinstall` hook to install the dependencies in each of the
sub-projects.

To make sure that everything is configured correctly run the following command
to compile both the client and the server once

```
yarn run compile
```

Now, depending on which part you want to work on follow the relevant section
below.

## Development Tools

To support a good develop workflow we set up [eslint][eslint], [Prettier][prettier] and integration tests using [Jest][jest]:

    yarn run check  # (runs lint, prettier and tests)
    yarn run lint
    yarn run test
    yarn run test:coverage

## Working on the client

### Visual Studio Code

Working on the client is simply a matter of starting vscode and using the Debug
View to launch the `Launch Client` task. This will open a new vscode window with the
extension loaded. It also looks for changes to your client code and recompiles
it whenever you save your changes.

### Atom

See the [ide-bash][ide-bash] package for Atom. Due to how Atom packages are
published the client lives in a separate repository.

## Working on the server

The easiest way right now is to simply compile and install the server globally
whenever you've made a change, and then reload your vscode window to re-launch
the server.

```
yarn run reinstall-server
# Reload vscode window.
```

I'm open to suggestions on how to improve this workflow.

[LSP]: https://microsoft.github.io/language-server-protocol/
[ide-bash]: https://github.com/mads-hartmann/ide-bash
[jest]: https://facebook.github.io/jest/
[prettier]: https://prettier.io/
[eslint]: https://eslint.org/
[yarn]: https://yarnpkg.com/lang/en/docs/install/
[node]: https://nodejs.org/en/download/
