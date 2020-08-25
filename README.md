# Bash Language Server

Bash language server implementation based on [Tree Sitter][tree-sitter] and its [grammar for Bash][tree-sitter-bash]
with [explainshell][explainshell] integration.

## Features

- [x] Jump to declaration
- [x] Find references
- [x] Code Outline & Show Symbols
- [x] Highlight occurrences
- [x] Code completion
- [x] Simple diagnostics reporting
- [x] Documentation for flags on hover
- [x] Workspace symbols
- [ ] Rename symbol

## Installation

```bash
npm i -g bash-language-server
```

If you encounter installation errors, ensure you have node version 8 or newer (`node --version`).


### Clients

The following editors and IDEs have available clients:

- Visual Studio Code ([Bash IDE][vscode-marketplace])
- Atom ([ide-bash][ide-bash])
- Sublime Text ([LSP-bash][sublime-text-lsp])
- Vim ([see below](#vim))
- Neovim ([see below](#neovim))
- [Oni](https://github.com/onivim/oni) ([see below](#oni))
- Eclipse ([ShellWax](https://marketplace.eclipse.org/content/shellwax))
- Emacs ([see below](#emacs))
- JupyterLab ([jupyterlab-lsp][jupyterlab-lsp])

#### Vim

For Vim 8 or later install the plugin [prabirshrestha/vim-lsp][vim-lsp] and add the following configuration to `.vimrc`:

```vim
if executable('bash-language-server')
  au User lsp_setup call lsp#register_server({
        \ 'name': 'bash-language-server',
        \ 'cmd': {server_info->[&shell, &shellcmdflag, 'bash-language-server start']},
        \ 'allowlist': ['sh'],
        \ })
endif
```

For Vim 8 or Neovim using [neoclide/coc.nvim][coc.nvim], according to [it's Wiki article](https://github.com/neoclide/coc.nvim/wiki/Language-servers#bash), add the following to your `coc-settings.json`:

```jsonc
  "languageserver": {
    "bash": {
      "command": "bash-language-server",
      "args": ["start"],
      "filetypes": ["sh"],
      "ignoredRootPaths": ["~"]
    }
  }
```

For Vim 8 or NeoVim using [dense-analysis/ale][vim-ale] add the following
configuration to your `.vimrc`:

```vim
let g:ale_linters = {
    \ 'sh': ['language_server'],
    \ }
```

#### Neovim

Install the plugin [autozimu/LanguageClient-neovim][languageclient-neovim] and add the following configuration to
`init.vim`:

```vim
let g:LanguageClient_serverCommands = {
    \ 'sh': ['bash-language-server', 'start']
    \ }
```

#### Oni

On the config file (`File -> Preferences -> Edit Oni config`) add the following configuration:

```javascript
"language.bash.languageServer.command": "bash-language-server",
"language.bash.languageServer.arguments": ["start"],
```

#### Emacs

[Lsp-mode](https://github.com/emacs-lsp/lsp-mode) has a built-in client, can be installed by `use-package`.
Add the configuration to your `.emacs.d/init.el`

```emacs-lisp
(use-package lsp-mode
  :commands lsp
  :hook
  (sh-mode . lsp))
```

## Development Guide

Please see [docs/development-guide][dev-guide] for more information.

[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-bash]: https://github.com/tree-sitter/tree-sitter-bash
[vscode-marketplace]: https://marketplace.visualstudio.com/items?itemName=mads-hartmann.bash-ide-vscode
[dev-guide]: https://github.com/bash-lsp/bash-language-server/blob/master/docs/development-guide.md
[ide-bash]: https://atom.io/packages/ide-bash
[sublime-text-lsp]: https://packagecontrol.io/packages/LSP-bash
[explainshell]: https://explainshell.com/
[languageclient-neovim]: https://github.com/autozimu/LanguageClient-neovim
[vim-lsp]: https://github.com/prabirshrestha/vim-lsp
[vim-ale]: https://github.com/dense-analysis/ale
[coc.nvim]: https://github.com/neoclide/coc.nvim
[jupyterlab-lsp]: https://github.com/krassowski/jupyterlab-lsp
