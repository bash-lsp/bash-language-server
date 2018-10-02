# Bash IDE

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

The client will now prompt to upgrade the Bash Language Server if you're running
an old version.

## 1.2.1

* Attempt to support windows by appending `cmd` to the command to start the
  server.
