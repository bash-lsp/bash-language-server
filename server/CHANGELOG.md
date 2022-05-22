# Bash Language Server

## 3.0.3

- Workaround for emscripten node 18 support https://github.com/bash-lsp/bash-language-server/pull/404

## 3.0.2

- Fix analyzer not being called when getHighlightParsingError is off https://github.com/bash-lsp/bash-language-server/pull/396

## 3.0.1

- Upgrade web-tree-sitter to fix node 18 issue https://github.com/bash-lsp/bash-language-server/pull/394

## 3.0.0

- Linting based on shellcheck (https://github.com/bash-lsp/bash-language-server/pull/342)
- BREAKING: Drop node 11 support (ton of dependencies upgraded).

## 2.1.0

- Fix failing to get options if bash-completion<=2.9 (https://github.com/bash-lsp/bash-language-server/pull/340)
- onHover now supports for multiline code comments (https://github.com/bash-lsp/bash-language-server/pull/348)
- Dependency upgrades

## 2.0.0

- BREAKING: Drop node 10 support
- Upgrade dependencies
- Adds support for completing command line arguments (https://github.com/bash-lsp/bash-language-server/pull/294)

## 1.17.0

- Default configuration change: parsing errors are not highlighted as problems (as the grammar is buggy)

## 1.16.1

- Fix brace expansion bug (https://github.com/bash-lsp/bash-language-server/pull/240)
- Do not crash if bash is not installed (https://github.com/bash-lsp/bash-language-server/pull/242)

## 1.16.0

- Improved completion handler for parameter expansions (https://github.com/bash-lsp/bash-language-server/pull/237)

## 1.15.0

- Use comments above symbols for documentation (https://github.com/bash-lsp/bash-language-server/pull/234, https://github.com/bash-lsp/bash-language-server/pull/235)

## 1.14.0

- onHover and onCompletion documentation improvements (https://github.com/bash-lsp/bash-language-server/pull/230)
- support 0/1 as values for `HIGHLIGHT_PARSING_ERRORS` (https://github.com/bash-lsp/bash-language-server/pull/231)

## 1.13.1

- Gracefully handle glob failures (https://github.com/bash-lsp/bash-language-server/pull/224, https://github.com/bash-lsp/bash-language-server/pull/226)
- Maintenance (https://github.com/bash-lsp/bash-language-server/pull/222, https://github.com/bash-lsp/bash-language-server/pull/225)

## 1.13.0

- Upgrade `vscode-languageserver` from 5 to 6 (https://github.com/bash-lsp/bash-language-server/pull/217)

## 1.12.0

- Completion handler improvements: remove duplicates, include symbols from other files, ensure that programs found on the paths are actually executable (https://github.com/bash-lsp/bash-language-server/pull/215)

## 1.11.3

- Recover from file reading errors (https://github.com/bash-lsp/bash-language-server/pull/211)

## 1.11.2

- Fix invalid documentHighlight response when word cannot be found (https://github.com/bash-lsp/bash-language-server/pull/209)

## 1.11.1

- Workspace symbols are resolved using fuzzy search (not just starting with it)

## 1.11.0

- Support for workspace symbols (https://github.com/bash-lsp/bash-language-server/pull/195)

## 1.10.0

- Improved completion handler and support auto-completion and documentation for [bash reserved words](https://www.gnu.org/software/bash/manual/html_node/Reserved-Word-Index.html) (https://github.com/bash-lsp/bash-language-server/pull/192)
- Upgrade tree-sitter

## 1.9.0

- Skip analyzing files with a non-bash shebang

## 1.8.0

- Extend file glob used for pre-analyzing files from `**/*.sh` to `**/*@(.sh|.inc|.bash|.command)`
- Make file glob configurable with `GLOB_PATTERN` environment variable

## 1.7.0

- Add PATH tilde expansion
- Builtins and man pages formatting

## 1.6.1

- Expose TypeScript typings from server
- Update vscode-languageserver dependency

## 1.6.0

- Switch to tree-sitter-wasm instead of tree-sitter (native bindings) to support node 12 and to ease installation (https://github.com/bash-lsp/bash-language-server/pull/147)

## 1.5.6

- Fix crash when parsing directories with `.sh` suffix (https://github.com/bash-lsp/bash-language-server/pull/111)
- Fix invalid LSP response (https://github.com/bash-lsp/bash-language-server/pull/110)

## 1.5.5

- Upgrade `tree-sitter` from `0.13.5` to `0.13.22`
- Upgrade `tree-sitter-bash` from `0.13.3` to `0.13.7`

## 1.5.4

- Fix explain shell configuration issue (https://github.com/bash-lsp/bash-language-server/issues/80)

## 1.5.3

- Support for showing warning for missing nodes
- Upgrade `tree-sitter-bash` to `0.13.3`

## 1.5.2

- Upgrade `tree-sitter` to `0.13.5` and `tree-sitter-bash` to `0.13.2`

## 1.5.1

- Upgrade `tree-sitter` and `tree-sitter-bash`
- Fixed build issue with 1.5.0

## 1.5.0

- Upgrade `tree-sitter` and `tree-sitter-bash`

## 1.4.1

- It's now possible to disable error reporting by setting the environment variable
  `HIGHLIGHT_PARSING_ERRORS` to `false`.

## 1.4.0

- Add support for explainshell implemented by [@chrismwendt][chrismwendt] [#45][45]
- Prefer explainshell output if it's enabled by [@maximbaz][maximbaz] [#58][58]

## 1.3.1

- More reliable NPM command execution on Windows [#40][40]

## 1.3.0

- Improved completions by adding support for

  - Suggestions based on the programs on your PATH [#17][17]
  - Suggestions based on the bash builtins [#33][33]

- Implemented the `onHover` message that now shows documentation for programs
  and builtins when you hover your cursor over words in the document. [#17][17]
  [#33][33]

- Improved outline hierarchy [#31][31]

- Upgraded tree-sitter bash and other libraries. [#28][28]

## 1.1.2

Update `tree-sitter` to `0.10.0` and `tree-sitter-bash` to `0.6.0`. This
improves the Bash parser. There are still known parsing issues. For more
information following the progress on this issue over at
[tree-sitter/tree-sitter-bash#9](https://github.com/tree-sitter/tree-sitter-bash/issues/9)

[17]: https://github.com/bash-lsp/bash-language-server/pull/17
[28]: https://github.com/bash-lsp/bash-language-server/pull/28
[31]: https://github.com/bash-lsp/bash-language-server/pull/31
[33]: https://github.com/bash-lsp/bash-language-server/pull/33
[40]: https://github.com/bash-lsp/bash-language-server/pull/40
[45]: https://github.com/bash-lsp/bash-language-server/pull/45
[58]: https://github.com/bash-lsp/bash-language-server/pull/58
[chrismwendt]: https://github.com/chrismwendt
[maximbaz]: https://github.com/maximbaz
