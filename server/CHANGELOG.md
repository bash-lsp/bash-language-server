# Bash Language Server

## 1.6.1

* Expose TypeScript typings from server
* Update vscode-languageserver dependency

## 1.6.0

* Switch to tree-sitter-wasm instead of tree-sitter (native bindings) to support node 12 and to ease installation (https://github.com/mads-hartmann/bash-language-server/pull/147)

## 1.5.6

* Fix crash when parsing directories with `.sh` suffix (https://github.com/mads-hartmann/bash-language-server/pull/111)
* Fix invalid LSP response (https://github.com/mads-hartmann/bash-language-server/pull/110)

## 1.5.5

* Upgrade `tree-sitter` from `0.13.5` to `0.13.22`
* Upgrade `tree-sitter-bash` from `0.13.3` to `0.13.7`

## 1.5.4

* Fix explain shell configuration issue (https://github.com/mads-hartmann/bash-language-server/issues/80)

## 1.5.3

* Support for showing warning for missing nodes
* Upgrade `tree-sitter-bash` to `0.13.3`

## 1.5.2

* Upgrade `tree-sitter` to `0.13.5` and `tree-sitter-bash` to `0.13.2`

## 1.5.1

* Upgrade `tree-sitter` and `tree-sitter-bash`
* Fixed build issue with 1.5.0

## 1.5.0

* Upgrade `tree-sitter` and `tree-sitter-bash`

## 1.4.1

* It's now possible to disable error reporting by setting the environment variable
  `HIGHLIGHT_PARSING_ERRORS` to `false`.

## 1.4.0

* Add support for explainshell implemented by [@chrismwendt][chrismwendt] [#45][45]
* Prefer explainshell output if it's enabled by [@maximbaz][maximbaz] [#58][58]

## 1.3.1

* More reliable NPM command execution on Windows [#40][40]

## 1.3.0

* Improved completions by adding support for

  * Suggestions based on the programs on your PATH [#17][17]
  * Suggestions based on the bash builtins [#33][33]

* Implemented the `onHover` message that now shows documentation for programs
  and builtins when you hover your cursor over words in the document. [#17][17]
  [#33][33]

* Improved outline hierarchy [#31][31]

* Upgraded tree-sitter bash and other libraries. [#28][28]

## 1.1.2

Update `tree-sitter` to `0.10.0` and `tree-sitter-bash` to `0.6.0`. This
improves the Bash parser. There are still known parsing issues. For more
information following the progress on this issue over at
[tree-sitter/tree-sitter-bash#9](https://github.com/tree-sitter/tree-sitter-bash/issues/9)

[17]: https://github.com/mads-hartmann/bash-language-server/pull/17
[28]: https://github.com/mads-hartmann/bash-language-server/pull/28
[31]: https://github.com/mads-hartmann/bash-language-server/pull/31
[33]: https://github.com/mads-hartmann/bash-language-server/pull/33
[40]: https://github.com/mads-hartmann/bash-language-server/pull/40
[45]: https://github.com/mads-hartmann/bash-language-server/pull/45
[58]: https://github.com/mads-hartmann/bash-language-server/pull/58
[chrismwendt]: https://github.com/chrismwendt
[maximbaz]: https://github.com/maximbaz
