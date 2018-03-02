# Bash Language Server

Bash language server implementation based on [Tree Sitter][tree-sitter] and its
[grammar for Bash][tree-sitter-bash].

## Features

- [x] Jump to declaration
- [x] Find references
- [x] Code Outline & Show Symbols
- [x] Highlight occurrences
- [x] Code completion
- [x] Simple diagnostics reporting
- [ ] Rename symbol

## Installation

Currently the client has only been implemented for Visual Studio Code. You can
install it from the marketplace - It's called [Bash IDE][vscode-marketplace].

**prerequisite:** The extension is using [node-gyp][node-gyp] to build the Bash
tree-sitter parser. See node-gyps [system requirements][node-gyp-installation].

## Development Guide

Please see [docs/development-guide][dev-guide] for more information.

[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-bash]: https://github.com/tree-sitter/tree-sitter-bash
[vscode-marketplace]: https://marketplace.visualstudio.com/items?itemName=mads-hartmann.bash-ide-vscode
[dev-guide]: https://github.com/mads-hartmann/bash-language-server/blob/master/docs/development-guide.md
[node-gyp-installation]: https://github.com/nodejs/node-gyp#installation
