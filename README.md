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

```bash
npm i -g bash-language-server
```

### Clients

Clients have been implemented for:

- Visual Studio Code ([Bash IDE][vscode-marketplace])
- Atom ([ide-bash][ide-bash]).

#### Neovim
Install the plugin [autozimu/LanguageClient-neovim](https://github.com/autozimu/LanguageClient-neovim) and add the following configuration to ``init.vim``:

```vim
let g:LanguageClient_serverCommands = {
    \ 'sh': ['bash-language-server', 'start']
    \ }
```

## Development Guide

Please see [docs/development-guide][dev-guide] for more information.

[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-bash]: https://github.com/tree-sitter/tree-sitter-bash
[vscode-marketplace]: https://marketplace.visualstudio.com/items?itemName=mads-hartmann.bash-ide-vscode
[dev-guide]: https://github.com/mads-hartmann/bash-language-server/blob/master/docs/development-guide.md
[ide-bash]: https://atom.io/packages/ide-bash
