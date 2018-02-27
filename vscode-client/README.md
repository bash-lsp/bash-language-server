# Bash IDE

Bash language server. Uses [Tree Sitter][tree-sitter] and its
[grammar for Bash][tree-sitter-bash].

## System Requirements

The extension is using [node-gyp][node-gyp] to build the bash tree-sitter parser
during installation. See node-gyps [system requirements][node-gyp-installation].

## Features

- [x] Jump to declaration
- [x] Find references
- [x] Code Outline & Show Symbols
- [x] Highlight occurrences
- [x] Code completion
- [x] Simple diagnostics reporting
- [ ] Rename symbol

[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-bash]: https://github.com/tree-sitter/tree-sitter-bash
[node-gyp]: https://github.com/nodejs/node-gyp
[node-gyp-installation]: https://github.com/nodejs/node-gyp#installation
