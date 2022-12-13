# Bash Language Server

Bash language server that brings an IDE-like experience for bash scripts to most editors. This is based on the [Tree Sitter parser][tree-sitter-bash] and supports [explainshell][explainshell] and [shellcheck][shellcheck].

We strongly recommend that you install [shellcheck][shellcheck] to enable linting: https://github.com/koalaman/shellcheck#installing

Documentation around configuration can be found in the [config.ts](https://github.com/bash-lsp/bash-language-server/blob/main/server/src/config.ts) file.

## Features

- Jump to declaration
- Find references
- Code Outline & Show Symbols
- Highlight occurrences
- Code completion
- Simple diagnostics reporting
- Documentation for symbols on hover
- Workspace symbols

To be implemented:

- Rename symbol
- Better jump to declaration and find references based on scope

## Installation

```bash
npm i -g bash-language-server
```

On Fedora based distros:

```bash
dnf install -y nodejs-bash-language-server
```

If you encounter installation errors, ensure you have node version 14 or newer (`node --version`).

### Clients

The following editors and IDEs have available clients:

- Atom ([ide-bash][ide-bash])
- Eclipse ([ShellWax](https://marketplace.eclipse.org/content/shellwax))
- Emacs ([see below](#emacs))
- [Helix](https://helix-editor.com/) (built-in support)
- JupyterLab ([jupyterlab-lsp][jupyterlab-lsp])
- Neovim ([see below](#neovim))
- Sublime Text ([LSP-bash][sublime-text-lsp])
- Vim ([see below](#vim))
- Visual Studio Code ([Bash IDE][vscode-marketplace])
- [Oni](https://github.com/onivim/oni) ([see below](#oni))

#### Vim

For Vim 8 or later install the plugin [prabirshrestha/vim-lsp][vim-lsp] and add the following configuration to `.vimrc`:

```vim
if executable('bash-language-server')
  au User lsp_setup call lsp#register_server({
        \ 'name': 'bash-language-server',
        \ 'cmd': {server_info->[&shell, &shellcmdflag, 'bash-language-server start']},
        \ 'allowlist': ['sh', 'bash'],
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

For Neovim v0.8:

```lua
vim.api.nvim_create_autocmd('FileType', {
  pattern = 'sh',
  callback = function()
    vim.lsp.start({
      name = 'bash-language-server',
      cmd = { 'bash-language-server', 'start' },
    })
  end,
})
```

For NeoVim using [autozimu/LanguageClient-neovim][languageclient-neovim], add the following configuration to
`init.vim`:

```vim
let g:LanguageClient_serverCommands = {
    \ 'sh': ['bash-language-server', 'start']
    \ }
```

For Vim8/NeoVim v0.5 using [jayli/vim-easycomplete](https://github.com/jayli/vim-easycomplete). Execute `:InstallLspServer sh` and config nothing. Maybe it's the easiest way to use bash-language-server in vim/nvim.

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
[shellcheck]: https://www.shellcheck.net/
[languageclient-neovim]: https://github.com/autozimu/LanguageClient-neovim
[nvim-lspconfig]: https://github.com/neovim/nvim-lspconfig
[vim-lsp]: https://github.com/prabirshrestha/vim-lsp
[vim-ale]: https://github.com/dense-analysis/ale
[coc.nvim]: https://github.com/neoclide/coc.nvim
[jupyterlab-lsp]: https://github.com/krassowski/jupyterlab-lsp
