# Bash IDE

Bash language server. Uses [Tree Sitter][tree-sitter] and its
[grammar for Bash][tree-sitter-bash] with [explainshell][explainshell] integration.

## System Requirements

You need to install that language server separately as it depends on native node
modules.

```bash
npm i -g bash-language-server
```

## Features

- [x] Jump to declaration
- [x] Find references
- [x] Code Outline & Show Symbols
- [x] Highlight occurrences
- [x] Code completion
- [x] Simple diagnostics reporting
- [x] Documentation for flags on hover
- [ ] Rename symbol

## Configuration

<lsp-adapter>

[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-bash]: https://github.com/tree-sitter/tree-sitter-bash
[explainshell]: https://explainshell.com/
