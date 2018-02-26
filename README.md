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
install it from the marketplace (It's called [Bash IDE][vscode-marketplace]).

## Development guide

Install the dependencies:

    npm install

Compile the server and vscode extension

    npm run compile

Continuously compile the server using

    npm run watch:server

Launch the extension using `Launch Client` from within vscode.

[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-bash]: https://github.com/tree-sitter/tree-sitter-bash
[vscode-marketplace]: https://marketplace.visualstudio.com/items?itemName=mads-hartmann.bash-ide-vscode
