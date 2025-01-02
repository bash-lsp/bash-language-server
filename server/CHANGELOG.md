# Bash Language Server

## 5.4.3

- Do not overwrite user-provided shellcheck `--shell` argument https://github.com/bash-lsp/bash-language-server/pull/1133

## 5.4.2

- Fix wrong pnpm engine version

## 5.4.1

- Bump treesitter to latest version

## 5.4.0

- Add .editorconfig support for shfmt https://github.com/bash-lsp/bash-language-server/pull/1171

## 5.3.4

- Add additonal shfmt formatting config options https://github.com/bash-lsp/bash-language-server/pull/1168

## 5.3.3

- Revert "Add --help fallback for documentation" https://github.com/bash-lsp/bash-language-server/pull/1052

## 5.3.2

- Handle non-zero exit status when formatting using shfmt https://github.com/bash-lsp/bash-language-server/pull/1163

## 5.3.1

- Clear diagnostics when closing document https://github.com/bash-lsp/bash-language-server/pull/1135

## 5.3.0

- Add support for formatting using shfmt (if installed). https://github.com/bash-lsp/bash-language-server/pull/1136

## 5.2.0

- Upgrade tree-sitter-bash from 0.20.7 to 0.22.5 https://github.com/bash-lsp/bash-language-server/pull/1148
- Dependency upgrades


## 5.1.2

- Use shellcheck's shell directive for selecting the dialect https://github.com/bash-lsp/bash-language-server/pull/1081

## 5.1.1

- Add --help fallback for documentation https://github.com/bash-lsp/bash-language-server/pull/1052

## 5.1.0

- Support for renaming symbol! https://github.com/bash-lsp/bash-language-server/pull/915

## 5.0.0

- Downgrade tree sitter to a stable version https://github.com/bash-lsp/bash-language-server/pull/911
- Drop support for Node.js 14 that is no longer maintained (security updates ended 30 Apr 2023) https://github.com/bash-lsp/bash-language-server/pull/893
- Internal changes: switch from yarn classic to pnpm https://github.com/bash-lsp/bash-language-server/pull/893

## 4.10.3

- Use cat as man pager https://github.com/bash-lsp/bash-language-server/pull/909

## 4.10.2

- Bump semver development dependency causing false positive distributions security warnings https://github.com/bash-lsp/bash-language-server/pull/905


## 4.10.1

- Handle tree-sitter-bash parse errors gracefully

## 4.10.0

- Upgrade tree-sitter-bash from [2022 November](https://api.github.com/repos/tree-sitter/tree-sitter-bash/git/commits/4488aa41406547e478636a4fcfd24f5bbc3f2f74) to [2023 May](https://api.github.com/repos/tree-sitter/tree-sitter-bash/git/commits/ee2a8f9906b53a785b784ee816c0016c2b6866d2)

## 4.9.3

- Fix flags/options insertion issue for some clients by using textEdits https://github.com/bash-lsp/bash-language-server/pull/861
- Dependency upgrades

## 4.9.2

- Fix flags/options insertion issue for some clients https://github.com/bash-lsp/bash-language-server/pull/847
- Dependency upgrades

## 4.9.1

- Snippets: add kind https://github.com/bash-lsp/bash-language-server/pull/816
- Snippets: use "-" instead of "." in snippets https://github.com/bash-lsp/bash-language-server/pull/812

## 4.9.0

- Add more snippets and change their naming convention https://github.com/bash-lsp/bash-language-server/pull/805

## 4.8.4

- Make source error diagnostics ("Source command could not be analyzed") configurable with the `enableSourceErrorDiagnostics` flag.

## 4.8.3

- Skip sending a `client/registerCapability` request when dynamic capability registration is not supported by the client https://github.com/bash-lsp/bash-language-server/pull/763

## 4.8.2

- ShellCheck: avoid using the diagnostic tag "deprecated" that allow clients to render diagnostics with a strike through https://github.com/bash-lsp/bash-language-server/pull/753

## 4.8.1

- Ensure ShellCheck directive parse does not throw on malformed input https://github.com/bash-lsp/bash-language-server/pull/749

## 4.8.0

- Use ShellCheck directives when analyzing source commands https://github.com/bash-lsp/bash-language-server/pull/747

## 4.7.0

- Support for bash options auto completions when using Brew or when `pkg-config` fails, but bash completions are found in `"${PREFIX:-/usr}/share/bash-completion/bash_completion"` https://github.com/bash-lsp/bash-language-server/pull/717

## 4.6.2

- Remove diagnostics for missing nodes that turns out to be unstable (this was introduced in 4.5.3) https://github.com/bash-lsp/bash-language-server/pull/708

## 4.6.1

- Fix the ShellCheck code action feature that for some clients did not return any code actions. https://github.com/bash-lsp/bash-language-server/pull/700

## 4.6.0

- Support parsing `: "${VARIABLE:="default"}"` as a variable definition https://github.com/bash-lsp/bash-language-server/pull/693

## 4.5.5

- Use sourcing info even if `includeAllWorkspaceSymbols` is true to ensure that files not matching the `globPattern` (and therefore not part of the background analysis) is still resolved based on source commands. https://github.com/bash-lsp/bash-language-server/pull/695

## 4.5.4

- Skip running ShellCheck for unsupported zsh files. We will still try for files without a shebang and without a known file extension. https://github.com/bash-lsp/bash-language-server/pull/694

## 4.5.3

- Fix issue where some features would work as expected in case of a syntax issue https://github.com/bash-lsp/bash-language-server/pull/691

## 4.5.2

- Fixed `onReferences` to respect the `context.includeDeclaration` flag https://github.com/bash-lsp/bash-language-server/pull/688
- Removed unnecessary dependency `urijs` https://github.com/bash-lsp/bash-language-server/pull/688

## 4.5.1

- Include grouped variables and functions when finding global declarations https://github.com/bash-lsp/bash-language-server/pull/685
- Skip completions in the middle of a non word when the following characters is not an empty list or whitespace. https://github.com/bash-lsp/bash-language-server/pull/684
- Remove infrequent and rather useless "Failed to parse" diagnostics (and thereby the `HIGHLIGHT_PARSING_ERRORS` and `highlightParsingErrors` configuration option) – the tree sitter parser is actually rather good at error recovery. Note that these messages will now be shown in the log. https://github.com/bash-lsp/bash-language-server/pull/686

## 4.5.0

- Include 30 snippets for language constructs (e.g. `if`), builtins (e.g. `test`), expansions (e.g. `[##]`), and external programs (e.g. `sed`) https://github.com/bash-lsp/bash-language-server/pull/683

## 4.4.0

- Improve source command parser and include diagnostics when parser fails https://github.com/bash-lsp/bash-language-server/pull/673
- Fix `onHover` bug where sourced symbols on the same line as a reference would hide documentation https://github.com/bash-lsp/bash-language-server/pull/673

## 4.3.2

- Improved CLI output https://github.com/bash-lsp/bash-language-server/pull/672

## 4.3.0

- Add centralized and configurable logger that can be controlled using the `BASH_IDE_LOG_LEVEL` environment variable and workspace configuration. https://github.com/bash-lsp/bash-language-server/pull/669

## 4.2.5

- Fix a critical bug causing memory leaks and high CPU usage for workspaces with many files https://github.com/bash-lsp/bash-language-server/pull/661

## 4.2.4

- Increase ShellCheck execution delay to 500ms after typing ends.

## 4.2.3

- Simpler debouncing for ShellCheck tasks where only the last request will return diagnostics https://github.com/bash-lsp/bash-language-server/pull/656

## 4.2.2

- Reduce CPU usage by introduce a short execution delay and throttling for ShellCheck tasks https://github.com/bash-lsp/bash-language-server/pull/655

## 4.2.1

- Add support for resolving loop variables https://github.com/bash-lsp/bash-language-server/pull/653

## 4.2.0

- Improve heuristic for resolving variables by taking the scope into account, both locally and when sourcing files. https://github.com/bash-lsp/bash-language-server/pull/649
- Support client responding with `null` for `workspace/configuration`. https://github.com/bash-lsp/bash-language-server/pull/650

## 4.1.3

- Correctly parse environment variable `BACKGROUND_ANALYSIS_MAX_FILES`, although clients should migrate to the new configuration system (see info in the 4.0.1 release). https://github.com/bash-lsp/bash-language-server/pull/640

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
