# Development guide

There are two moving parts.

- **Server**: A node server written in Typescript that implements the
  [Language Server Protocol (LSP)][LSP].

- **Client**: A super tiny Visual Studio Code (vscode) extension which basically
  just tells vscode how to launch the LSP server.

The project has a root `package.json` file which is really just there for
convenience - it proxies to the `package.json` files in the `vscode-client` and
`server` folders.

## Initial setup

Run the following in the root of the project

```
npm install
```

This uses the `postinstall` hook to install the dependencies in each of the
sub-projects.

To make sure that everything is configured correctly run the following command
to compile both the client and the server once

```
npm run compile
```

Now, depending on which part you want to work on follow the relevant section
below.

## Working on the client

Working on the client is simply a matter of starting vscode and using the Debug
View to launch the `Launch Client` task. This will open a new vscode window with the
extension loaded. It also looks for changes to your client code and recompiles
it whenever you save your changes.

## Working on the server

The easiest way right now is to simple compile and install the server globally
whenever you've made a change, and then reload you vscode window to re-launch
the server.

```
cd server
npm run compile
npm i -g .
# Reload vscode window.
```

I'm open to suggestions on how to improve this workflow.

[LSP]: https://microsoft.github.io/language-server-protocol/
