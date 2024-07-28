# Bash IDE

[![VS Marketplace installs](https://badgen.net/vs-marketplace/i/mads-hartmann.bash-ide-vscode?label=VS%20Marketplace%20installs)](https://marketplace.visualstudio.com/items?itemName=mads-hartmann.bash-ide-vscode)
[![VS Marketplace downloads](https://badgen.net/vs-marketplace/d/mads-hartmann.bash-ide-vscode?label=VS%20Marketplace%20downloads)](https://marketplace.visualstudio.com/items?itemName=mads-hartmann.bash-ide-vscode)
[![Open VSX downloads](https://badgen.net/open-vsx/d/mads-hartmann/bash-ide-vscode?color=purple&label=Open%20VSX%20downloads)](https://open-vsx.org/extension/mads-hartmann/bash-ide-vscode)

Visual Studio Code extension utilizing the [Bash Language Server](bash-lsp) and integrating with [explainshell][explainshell], [shellcheck][shellcheck] and [shfmt][shfmt].

We recommend that you [install shellcheck](https://github.com/koalaman/shellcheck#installing) to enable linting and [install shfmt](https://github.com/mvdan/sh?tab=readme-ov-file#shfmt) to enable formatting.

## Features

- [x] Jump to declaration
- [x] Find references
- [x] Code Outline & Show Symbols
- [x] Highlight occurrences
- [x] Code completion
- [x] Simple diagnostics reporting
- [x] Documentation for flags on hover
- [x] Workspace symbols
- [x] Rename symbol
- [x] Format document
- [x] Snippets

## Configuration

To get documentation for flags on hover (thanks to explainshell), run a explainshell server and update your VS Code settings:

```
    "bashIde.explainshellEndpoint": "http://localhost:5000",
```

For security reasons, it defaults to `""`, which disables explainshell integration. When set, this extension will send requests to the endpoint and displays documentation for flags. We recommend using a local Docker image (see https://github.com/bash-lsp/bash-language-server/issues/180).

[bash-lsp]: https://github.com/bash-lsp/bash-language-server
[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-bash]: https://github.com/tree-sitter/tree-sitter-bash
[explainshell]: https://explainshell.com/
[shellcheck]: https://www.shellcheck.net/
[shfmt]: https://github.com/mvdan/sh
