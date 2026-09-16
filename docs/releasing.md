# Releasing

Release notes are maintained on [GitHub Releases](https://github.com/bash-lsp/bash-language-server/releases).
On pushes to `main`, the deployment workflow runs the existing release scripts to publish packages, push version tags, and create GitHub releases with automatically generated notes.

## Client

To release a new version of the vscode extension

- Bump the version in `vscode-client/package.json`
- Merge to main branch
- CI publishes the extension and creates the `vscode-client-<version>` GitHub release

## Server

To release a new version of the server

- Bump the version in `server/package.json`
- Merge to main branch
- CI publishes the server and creates the `server-<version>` GitHub release
