# Bash IDE

## 1.43.0
- Upgrade language server to 5.4.2 (treesitter upgrade).

## 1.42.0
- Upgrade language server to 5.4.0 (format document capability).

## 1.41.0
- Upgrade language server to 5.2.0

## 1.40.0
- Upgrade language server to 5.1.1 (rename capability).

## 1.39.0
- Upgrade language server to 5.0.0.

## 1.38.0
- Upgrade language server to 4.10.0.

## 1.37.0
- Upgrade language server to 4.9.2.
- Fix flags/options insertion issue.
- More snippets.

## 1.36.0
- Upgrade language server to 4.8.4.
- Source error diagnostics ("Source command could not be analyzed") is now disabled by default and can be re-enable using the  `enableSourceErrorDiagnostics` configuration flag.

## 1.35.0
- Upgrade language server to 4.8.2.
- ShellCheck: avoid using the diagnostic tag "deprecated" which renders diagnostics with a strike through

## 1.34.0

- Upgrade language server to 4.8.1.
- Use ShellCheck directives when analyzing source commands
- Support for bash options auto completions when using Brew or when `pkg-config` fails, but bash completions are found in `"${PREFIX:-/usr}/share/bash-completion/bash_completion"`


## 1.33.0

- Upgrade language server to 4.6.2.
- Remove diagnostics for missing nodes that turns out to be unstable (this was introduced in 1.30.0).
- Support parsing `: "${VARIABLE:="default"}"` as a variable definition.

## 1.32.0

- Upgrade language server to 4.5.5.
- Use sourcing info even if `includeAllWorkspaceSymbols` is true to ensure that files not matching the `globPattern` (and therefore not part of the background analysis) is still resolved based on source commands.

## 1.31.0

- Upgrade language server to 4.5.4.
- Skip running ShellCheck for unsupported zsh files. We will still run it for bash like files without a shebang or without a known file extension.

## 1.30.0

- Upgrade language server to 4.5.3.
- Fix issue where some features would work as expected in case of a syntax issue
- Fixed `onReferences` to respect the `context.includeDeclaration` flag
- Removed unnecessary dependency `urijs`

## 1.29.0

- Upgrade language server to 4.5.1.
- Improved parsing of global declarations.
- Skip completions in the middle of a non word when the following characters is not an empty list or whitespace.
- Remove infrequent and rather useless "Failed to parse" diagnostics and the `highlightParsingErrors` configuration option – the tree sitter parser is actually rather good at error recovery. Note that these messages will now be shown in the log.

## 1.28.0

- Upgrade language server to 4.5.0.
- Include 30 snippets for language constructs (e.g. `if`), builtins (e.g. `test`), expansions (e.g. `[##]`), and external programs (e.g. `sed`).
- Improved source command parsing.
- Includes diagnostics when we fail to analyze source commands.
- Logging is improved and configurable.

## 1.27.0

- FAULTY RELEASE. The server was stuck on version 4.2.5, but new logging configuration was shipped which made the server fail loading the configuration.

## 1.26.0

- Upgrade language server to 4.2.5 fixing a critical performance issue for workspaces with many files.

## 1.25.0

- Upgrade language server to 4.2.4 with a better ShellCheck performance and support for resolving loop variables.

## 1.24.0

- Upgrade language server to 4.2.0.

## 1.23.0

- Upgrade language server to 4.1.2.

## 1.22.0

- Upgrade language server to 4.1.1.

## 1.21.0

- Upgrade language server to 4.1.0 that makes symbols lookup based on sourced files (using non dynamic statements like `source file.sh` or `. ~/file.inc`) instead of including all symbols from the workspace. We now also support jump-to-definition on the file path used in a source command. The new behavior can be disabled by turning on the `includeAllWorkspaceSymbols` configuration option.

## 1.20.1

- Upgrade language server to 4.0.1 that enables ShellCheck code actions (quick fixes), remove duplicated error codes, add URLs and tags, support parsing dialects (sh, bash, dash, ksh) but still fallback to bash, enable configuring ShellCheck arguments using the `shellcheckArguments` configuration parameter and allows for changing settings while the extension is running.

## 1.18.0

- Upgrade language server to 4.0.0-beta.1 that enables a better ShellCheck integration.

## 1.17.0

- Upgrade language server to 3.3.0 that enables faster background analysis and defaults to enabling ShellCheck linting the ShellCheck executable is found. We strongly recommend installing ShellCheck.

## 1.16.2

- Upgrade language server to 3.2.3

## 1.16.1

- Fix incorrect link in README

## 1.16.0

- Upgrade language server to 3.2.0

## 1.15.0

- Upgrade language server to 3.1.0

## 1.14.0

- Upgrade language server to 3.0.3 that includes support for Shellcheck linting (please follow https://github.com/koalaman/shellcheck#installing to install Shellcheck)

## 1.13.0

- Upgrade language server to 2.1.0

## 1.12.1

- Bug fix to fix server not starting

## 1.12.0

- Upgrade language server to 2.0.0

## 1.11.0

- Default configuration change: parsing errors are not highlighted as problems (as the grammar is buggy)

## 1.10.2

- Upgrade language server to 1.16.1 (fix brace expansion bug and crash when bash is not installed)

## 1.10.1

- Upgrade language server to 1.16.0 (improved completion support for parameters)

## 1.10.0

- Upgrade language server to 1.15.0 (improved hover and completion documentation)

## 1.9.1

- Upgrade language server to 1.13.1 (improved file lookup error handling)

## 1.9.0

- Upgrade language server to 1.13.0 (improved completion handler with suggestions based on variables and functions found in the workspace)

## 1.8.0

- Upgrade language server to 1.11.1 (support for workspace symbols). This can for example be used by doing `Command + P` and then write `# someSearchQuery`

## 1.7.0

- Upgrade language server to 1.10.0 (improved completion handler)

## 1.6.0

- Upgrade language server to 1.9.0 (skip analyzing files with a non-bash shebang)

## 1.5.0

- Upgrade language server to 1.8.0 (PATH tilde expansion, builtins and man pages formatting, pre-analyzes more files than just .sh)

* Make file glob configurable

- Remove unused `bashIde.path` configuration parameter

## 1.4.0

- Remove additional installation step by integrating the `bash-language-server` (version 1.6.1)

## 1.3.3

- Force people to upgrade their `bash-language-server` installation to `1.5.2`.

## 1.3.2

- Added a new configuration option `bashIde.highlightParsingErrors` which defaults
  to `true`. When enabled it will report parsing errors as 'problems'. This means you
  can now disable the error reporting which is convenient as `shellcheck` performs a
  better job of linting and our parser still has many issues.

## 1.3.1

- Added new configuration option `bashIde.path` for specifying the exact
  location of the binary.
- Added new configuration option `bashIde.explainshellEndpoint` that you can use
  to enable explainshell integration.

## 1.3.0

- The client will now prompt to upgrade the Bash Language Server if you're running
  an old version.

## 1.2.1

- Attempt to support windows by appending `cmd` to the command to start the
  server.
