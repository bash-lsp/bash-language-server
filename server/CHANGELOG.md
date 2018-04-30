# Bash Language Server

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

[17]: https://github.com/mads-hartmann/bash-language-server/pull/17
[28]: https://github.com/mads-hartmann/bash-language-server/pull/28
[31]: https://github.com/mads-hartmann/bash-language-server/pull/31
[33]: https://github.com/mads-hartmann/bash-language-server/pull/33
[40]: https://github.com/mads-hartmann/bash-language-server/pull/40
