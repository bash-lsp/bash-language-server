# Bash IDE

## 1.11.0

* Default configuration change: parsing errors are not highlighted as problems (as the grammar is buggy)

## 1.10.2

* Upgrade language server to 1.16.1 (fix brace expansion bug and crash when bash is not installed)

## 1.10.1

* Upgrade language server to 1.16.0 (improved completion support for parameters)

## 1.10.0

* Upgrade language server to 1.15.0 (improved hover and completion documentation)

## 1.9.1

* Upgrade language server to 1.13.1 (improved file lookup error handling)

## 1.9.0

* Upgrade language server to 1.13.0 (improved completion handler with suggestions based on variables and functions found in the workspace)

## 1.8.0

* Upgrade language server to 1.11.1 (support for workspace symbols). This can for example be used by doing `Command + P` and then write `# someSearchQuery`

## 1.7.0

* Upgrade language server to 1.10.0 (improved completion handler)

## 1.6.0

* Upgrade language server to 1.9.0 (skip analyzing files with a non-bash shebang)

## 1.5.0

* Upgrade language server to 1.8.0 (PATH tilde expansion, builtins and man pages formatting, pre-analyzes more files than just .sh)
- Make file glob configurable
* Remove unused `bashIde.path` configuration parameter

## 1.4.0

* Remove additional installation step by integrating the `bash-language-server` (version 1.6.1)

## 1.3.3

* Force people to upgrade their `bash-language-server` installation to `1.5.2`.

## 1.3.2

* Added a new configuration option `bashIde.highlightParsingErrors` which defaults
  to `true`. When enabled it will report parsing errors as 'problems'. This means you
  can now disable the error reporting which is convenient as `shellcheck` performs a
  better job of linting and our parser still has many issues.

## 1.3.1

* Added new configuration option `bashIde.path` for specifying the exact
  location of the binary.
* Added new configuration option `bashIde.explainshellEndpoint` that you can use
  to enable explainshell integration.

## 1.3.0

* The client will now prompt to upgrade the Bash Language Server if you're running
an old version.

## 1.2.1

* Attempt to support windows by appending `cmd` to the command to start the
  server.
