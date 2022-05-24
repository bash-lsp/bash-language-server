# Bash IDE

Visual Studio Code extension utilizing the [bash language server](bash-lsp), that is based on [Tree Sitter][tree-sitter] and its [grammar for Bash][tree-sitter-bash] and supports [explainshell][explainshell] integration.

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

## Configuration

To get documentation for flags on hover (thanks to explainshell), run a explainshell server and update your VS Code settings:

```
    "bashIde.explainshellEndpoint": "http://localhost:5000",
```

For security reasons, it defaults to `""`, which disables explainshell integration. When set, this extension will send requests to the endpoint and displays documentation for flags. We recommend using a local Docker image (see https://github.com/bash-lsp/bash-language-server/issues/180).

[bash-lsp]: https://github.com/bash-lsp/bash-language-server/tree/main/server
[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-bash]: https://github.com/tree-sitter/tree-sitter-bash
[explainshell]: https://explainshell.com/
