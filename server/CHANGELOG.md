# Bash Language Server

## 4.1.2

- Correct ShellCheck `source-path` argument to support following sources based on the local folder of the file and the workspace root.

## 4.1.1

- Background analysis: handle workspace root being a URL https://github.com/bash-lsp/bash-language-server/pull/625
- Shell documentation: add `--noprofile --norc` to avoid config files breaking formatting https://github.com/bash-lsp/bash-language-server/pull/626

## 4.1.0

- Symbols across files are now only included based on sourced files (using non dynamic statements like `source file.sh` or `. ~/file.inc`) instead of including symbols from all files in the workspace. We now also support jump-to-definition on the file path used in a source command. The new behavior can be disabled by turning on the `includeAllWorkspaceSymbols` configuration option. https://github.com/bash-lsp/bash-language-server/pull/244

## 4.0.1

- **Breaking**: Drop support for Node 12, which reached its official end of life on April 30th 2022. Doing so enables new features. https://github.com/bash-lsp/bash-language-server/pull/584
- ShellCheck: support code actions, remove duplicated error codes, add URLs and tags, support parsing dialects (sh, bash, dash, ksh) but still fallback to bash, enable configuring ShellCheck arguments using the `shellcheckArguments` configuration parameter (legacy environment variable: `SHELLCHECK_ARGUMENTS`)
- Support workspace configuration instead of environment variables which enables updating configuration without reloading the server. We still support environment variables, but clients **should migrate to the new workspace configuration**. https://github.com/bash-lsp/bash-language-server/pull/599
- Allow disabling background analysis by setting `backgroundAnalysisMaxFiles: 0`.

## 3.3.1

- Fix missing documentation for some help pages https://github.com/bash-lsp/bash-language-server/pull/577

## 3.3.0

- Performant globbing and background analysis that should fix the server crashing for large workspaces. We currently limit the files parsed to 500, but can be configured using the `BACKGROUND_ANALYSIS_MAX_FILES` environment variable https://github.com/bash-lsp/bash-language-server/pull/569
- Enable ShellCheck integration to be disabled from the configuration. The default configuration used should be "shellcheck". https://github.com/bash-lsp/bash-language-server/pull/571
- Support more bash shebangs when doing background analysis https://github.com/bash-lsp/bash-language-server/pull/568

## 3.2.3

- Fix auto detection for path of shellcheck.exe on Windows https://github.com/bash-lsp/bash-language-server/pull/563

## 3.2.2

- Get rid of deprecated dependencies for the explainshell integration https://github.com/bash-lsp/bash-language-server/pull/564

## 3.2.1

- Fix shebang parser that ignores some bash files https://github.com/bash-lsp/bash-language-server/pull/560

## 3.2.0

- Dependency upgrades
- Default to shellcheck binary found on path https://github.com/bash-lsp/bash-language-server/pull/555

## 3.1.1

- Dependency upgrades
- Improve ShellCheck robustness for files without shebang https://github.com/bash-lsp/bash-language-server/pull/536

## 3.1.0

- Bunch of dependency upgrades
- Better completion kind https://github.com/bash-lsp/bash-language-server/pull/466

## 3.0.5

- Fix Shellcheck issue when using vim-lsp https://github.com/bash-lsp/bash-language-server/pull/443

## 3.0.4

- Fix Windows support for analyzer https://github.com/bash-lsp/bash-language-server/pull/433

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
