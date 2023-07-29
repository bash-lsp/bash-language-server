/**
 * Naming convention for `documentation`:
 * - for Bash operators it's '<operator> operator'
 * - for Bash documentation it's 'documentation definition' or '"<documentation>" documentation definition'
 * - for Bash functions it's 'function definition' or '"<function>" function definition'
 * - for Bash builtins it's '"<builtin>" invocation'
 * - for Bash character classes it's any string with optional mnemonics depicted via square brackets
 * - for shell shebang it's 'shebang'
 * - for anything else it's any string
 *
 * Naming convention for `label`:
 * - for shell shebang it's 'shebang' or 'shebang-with-arguments'
 * - for Bash operators it's '<operator>[<nested-operator>]', where:
 *   - <operator> is Bash operator
 *   - <nested-operator> is 'test'
 *     used when [[ command is contained in <operator> condition
 *   - term delimiter: dash, like 'if-test'
 * - for Bash parameter expansions it's '[<prefix>]<expression>', where:
 *   - <prefix> is one of 'set'/'error'
 *     used when expansion modifies variable or prints error to stderr
 *   - <expession> is 'if-(set|unset)[-or-[not-]null]'
 *   - term delimiter: dash, like 'set-if-unset-or-null'
 * - for Bash brace expansion it's 'range'
 * - for Bash documentation it's one of 'documentation'/'<documentation>'
 * - for Bash functions it's one of 'function'/'<function>'
 * - for Bash builtins it's '<builtin>'
 * - for Bash character classes it's '<character-class>'
 * - for Sed it's 'sed:<expression>'
 * - for Awk it's 'awk:<expression>'
 * - for anything else it's any string
 */
import { CompletionItemKind, InsertTextFormat, MarkupKind } from 'vscode-languageserver'

import { BashCompletionItem, CompletionItemDataType } from './types'

export const SNIPPETS: BashCompletionItem[] = [
  {
    documentation: 'shebang',
    label: 'shebang',
    insertText: '#!/usr/bin/env ${1|bash,sh|}',
  },
  {
    documentation: 'shebang-with-arguments',
    label: 'shebang-with-arguments',
    insertText: '#!/usr/bin/env ${1|-S,--split-string|} ${2|bash,sh|} ${3|argument ...|}',
  },
  {
    label: 'and',
    documentation: 'and operator',
    insertText: '${1:first-expression} && ${2:second-expression}',
  },
  {
    label: 'or',
    documentation: 'or operator',
    insertText: '${1:first-expression} || ${2:second-expression}',
  },
  {
    label: 'if',
    documentation: 'if operator',
    insertText: ['if ${1:condition}; then', '\t${2:command ...}', 'fi'].join('\n'),
  },
  {
    label: 'if-else',
    documentation: 'if-else operator',
    insertText: [
      'if ${1:condition}; then',
      '\t${2:command ...}',
      'else',
      '\t${3:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-less',
    documentation: 'if with number comparison',
    insertText: [
      'if (( "${1:first-expression}" < "${2:second-expression}" )); then',
      '\t${3:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-greater',
    documentation: 'if with number comparison',
    insertText: [
      'if (( "${1:first-expression}" > "${2:second-expression}" )); then',
      '\t${3:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-less-or-equal',
    documentation: 'if with number comparison',
    insertText: [
      'if (( "${1:first-expression}" <= "${2:second-expression}" )); then',
      '\t${3:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-greater-or-equal',
    documentation: 'if with number comparison',
    insertText: [
      'if (( "${1:first-expression}" >= "${2:second-expression}" )); then',
      '\t${3:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-equal',
    documentation: 'if with number comparison',
    insertText: [
      'if (( "${1:first-expression}" == "${2:second-expression}" )); then',
      '\t${3:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-not-equal',
    documentation: 'if with number comparison',
    insertText: [
      'if (( "${1:first-expression}" != "${2:second-expression}" )); then',
      '\t${3:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-string-equal',
    documentation: 'if with string comparison',
    insertText: [
      'if [[ "${1:first-expression}" == "${2:second-expression}" ]]; then',
      '\t${3:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-string-not-equal',
    documentation: 'if with string comparison',
    insertText: [
      'if [[ "${1:first-expression}" != "${2:second-expression}" ]]; then',
      '\t${3:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-string-empty',
    documentation: 'if with string comparison (has [z]ero length)',
    insertText: ['if [[ -z "${1:expression}" ]]; then', '\t${2:command ...}', 'fi'].join(
      '\n',
    ),
  },
  {
    label: 'if-string-not-empty',
    documentation: 'if with string comparison ([n]ot empty)',
    insertText: ['if [[ -n "${1:expression}" ]]; then', '\t${2:command ...}', 'fi'].join(
      '\n',
    ),
  },
  {
    label: 'if-defined',
    documentation: 'if with variable existence check',
    insertText: ['if [[ -n "${${1:variable}+x}" ]]', '\t${2:command ...}', 'fi'].join(
      '\n',
    ),
  },
  {
    label: 'if-not-defined',
    documentation: 'if with variable existence check',
    insertText: ['if [[ -z "${${1:variable}+x}" ]]', '\t${2:command ...}', 'fi'].join(
      '\n',
    ),
  },
  {
    label: 'while',
    documentation: 'while operator',
    insertText: ['while ${1:condition}; do', '\t${2:command ...}', 'done'].join('\n'),
  },
  {
    label: 'while-else',
    documentation: 'while-else operator',
    insertText: [
      'while ${1:condition}; do',
      '\t${2:command ...}',
      'else',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-less',
    documentation: 'while with number comparison',
    insertText: [
      'while (( "${1:first-expression}" < "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-greater',
    documentation: 'while with number comparison',
    insertText: [
      'while (( "${1:first-expression}" > "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-less-or-equal',
    documentation: 'while with number comparison',
    insertText: [
      'while (( "${1:first-expression}" <= "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-greater-or-equal',
    documentation: 'while with number comparison',
    insertText: [
      'while (( "${1:first-expression}" >= "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-equal',
    documentation: 'while with number comparison',
    insertText: [
      'while (( "${1:first-expression}" == "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-not-equal',
    documentation: 'while with number comparison',
    insertText: [
      'while (( "${1:first-expression}" != "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-string-equal',
    documentation: 'while with string comparison',
    insertText: [
      'while [[ "${1:first-expression}" == "${2:second-expression}" ]]; do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-string-not-equal',
    documentation: 'while with string comparison',
    insertText: [
      'while [[ "${1:first-expression}" != "${2:second-expression}" ]]; do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-string-empty',
    documentation: 'while with string comparison (has [z]ero length)',
    insertText: [
      'while [[ -z "${1:expression}" ]]; do',
      '\t${2:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-string-not-empty',
    documentation: 'while with string comparison ([n]ot empty)',
    insertText: [
      'while [[ -n "${1:expression}" ]]; do',
      '\t${2:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-defined',
    documentation: 'while with variable existence check',
    insertText: [
      'while [[ -n "${${1:variable}+x}" ]]',
      '\t${2:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'while-not-defined',
    documentation: 'while with variable existence check',
    insertText: [
      'while [[ -z "${${1:variable}+x}" ]]',
      '\t${2:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until',
    documentation: 'until operator',
    insertText: ['until ${1:condition}; do', '\t${2:command ...}', 'done'].join('\n'),
  },
  {
    label: 'until-else',
    documentation: 'until-else operator',
    insertText: [
      'until ${1:condition}; do',
      '\t${2:command ...}',
      'else',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-less',
    documentation: 'until with number comparison',
    insertText: [
      'until (( "${1:first-expression}" < "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-greater',
    documentation: 'until with number comparison',
    insertText: [
      'until (( "${1:first-expression}" > "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-less-or-equal',
    documentation: 'until with number comparison',
    insertText: [
      'until (( "${1:first-expression}" <= "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-greater-or-equal',
    documentation: 'until with number comparison',
    insertText: [
      'until (( "${1:first-expression}" >= "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-equal',
    documentation: 'until with number comparison',
    insertText: [
      'until (( "${1:first-expression}" == "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-not-equal',
    documentation: 'until with number comparison',
    insertText: [
      'until (( "${1:first-expression}" != "${2:second-expression}" )); do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-string-equal',
    documentation: 'until with string comparison',
    insertText: [
      'until [[ "${1:first-expression}" == "${2:second-expression}" ]]; do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-string-not-equal',
    documentation: 'until with string comparison',
    insertText: [
      'until [[ "${1:first-expression}" != "${2:second-expression}" ]]; do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-string-empty',
    documentation: 'until with string comparison (has [z]ero length)',
    insertText: [
      'until [[ -z "${1:expression}" ]]; do',
      '\t${2:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-string-not-empty',
    documentation: 'until with string comparison ([n]ot empty)',
    insertText: [
      'until [[ -n "${1:expression}" ]]; do',
      '\t${2:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-defined',
    documentation: 'until with variable existence check',
    insertText: [
      'until [[ -n "${${1:variable}+x}" ]]',
      '\t${2:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'until-not-defined',
    documentation: 'until with variable existence check',
    insertText: [
      'until [[ -z "${${1:variable}+x}" ]]',
      '\t${2:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'for',
    documentation: 'for operator',
    insertText: [
      'for ${1:item} in ${2:expression}; do',
      '\t${3:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'for-range',
    documentation: 'for with range',
    insertText: [
      'for ${1:item} in $(seq ${2:from} ${3:to}); do',
      '\t${4:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'for-stepped-range',
    documentation: 'for with stepped range',
    insertText: [
      'for ${1:item} in $(seq ${2:from} ${3:step} ${4:to}); do',
      '\t${5:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'for-files',
    documentation: 'for with files',
    insertText: [
      'for ${1:item} in *.${2:extension}; do',
      '\t${4:command ...}',
      'done',
    ].join('\n'),
  },
  {
    label: 'case',
    documentation: 'case operator',
    insertText: [
      'case "${1:expression}" in',
      '\t${2:pattern})',
      '\t\t${3:command ...}',
      '\t\t;;',
      '\t*)',
      '\t\t${4:command ...}',
      '\t\t;;',
      'end',
    ].join('\n'),
  },
  {
    label: 'function',
    documentation: 'function definition',
    insertText: ['${1:name}() {', '\t${2:command ...}', '}'].join('\n'),
  },
  {
    documentation: 'documentation definition',
    label: 'documentation',
    insertText: [
      '# ${1:function_name} ${2:function_parameters}',
      '# ${3:function_description}',
      '#',
      '# Output:',
      '#   ${4:function_output}',
      '#',
      '# Return:',
      '# - ${5:0} when ${6:all parameters are correct}',
      '# - ${7:1} ${8:otherwise}',
    ].join('\n'),
  },
  {
    documentation: 'if unset or null',
    label: 'if-unset-or-null',
    insertText: '"\\${${1:variable}:-${2:default}}"',
  },
  {
    documentation: 'if unset',
    label: 'if-unset',
    insertText: '"\\${${1:variable}-${2:default}}"',
  },
  {
    documentation: 'set if unset or null',
    label: 'set-if-unset-or-null',
    insertText: '"\\${${1:variable}:=${2:default}}"',
  },
  {
    documentation: 'set if unset',
    label: 'set-if-unset',
    insertText: '"\\${${1:variable}=${2:default}}"',
  },
  {
    documentation: 'error if unset or null',
    label: 'error-if-unset-or-null',
    insertText: '"\\${${1:variable}:?${2:error_message}}"',
  },
  {
    documentation: 'error if unset',
    label: 'error-if-unset',
    insertText: '"\\${${1:variable}?${2:error_message}}"',
  },
  {
    documentation: 'if set or not null',
    label: 'if-set-or-not-null',
    insertText: '"\\${${1:variable}:+${2:alternative}}"',
  },
  {
    documentation: 'if set',
    label: 'if-set',
    insertText: '"\\${${1:variable}+${2:alternative}}"',
  },
  {
    documentation: 'without shortest leading pattern',
    label: 'without-shortest-leading-pattern',
    insertText: '"\\${${1:variable}#${2:pattern}}"',
  },
  {
    documentation: 'without longest leading pattern',
    label: 'without-longest-leading-pattern',
    insertText: '"\\${${1:variable}##${2:pattern}}"',
  },
  {
    documentation: 'without shortest trailing pattern',
    label: 'without-shortest-trailing-pattern',
    insertText: '"\\${${1:variable}%${2:pattern}}"',
  },
  {
    documentation: 'without longest trailing pattern',
    label: 'without-longest-trailing-pattern',
    insertText: '"\\${${1:variable}%%${2:pattern}}"',
  },
  {
    documentation: '.. expansion',
    label: 'range',
    insertText: '{${1:from}..${2:to}}',
  },
  {
    documentation: '"echo" invocation',
    label: 'echo',
    insertText: 'echo "${1:message}"',
  },
  {
    documentation: '"printf" invocation',
    label: 'printf',
    insertText:
      'printf \'${1|%c,%s,%d,%f,%15c,%15s,%15d,%15f,%.5s,%.5d,%.5f|}\' "${2:message}"',
  },
  {
    documentation: '"source" invocation',
    label: 'source',
    insertText: '${1|source,.|} "${2:path/to/file}"',
  },
  {
    documentation: '"alias" invocation',
    label: 'alias',
    insertText: 'alias ${1:name}=${2:value}',
  },
  {
    documentation: '"cd" invocation',
    label: 'cd',
    insertText: 'cd "${1:path/to/directory}"',
  },
  {
    documentation: '"getopts" invocation',
    label: 'getopts',
    insertText: 'getopts ${1:optstring} ${2:name}',
  },
  {
    documentation: '"jobs" invocation',
    label: 'jobs',
    insertText: 'jobs -x ${1:command}',
  },
  {
    documentation: '"kill" invocation',
    label: 'kill',
    insertText: 'kill ${1|-l,-L|}',
  },
  {
    documentation: '"let" invocation',
    label: 'let',
    insertText: 'let ${1:argument}',
  },
  {
    documentation: '"test" invocation',
    label: 'test',
    insertText:
      '[[ ${1:argument1} ${2|-ef,-nt,-ot,==,=,!=,=~,<,>,-eq,-ne,-lt,-le,-gt,-ge|} ${3:argument2} ]]',
  },
  {
    documentation: 'line print',
    label: 'sed:print',
    insertText: "sed '' ${1:path/to/file}",
  },
  {
    documentation: 'line pattern filter',
    label: 'sed:filter-by-line-pattern',
    insertText:
      "sed ${1|--regexp-extended,-E|} ${2|--quiet,-n|} '/${3:pattern}/p' ${4:path/to/file}",
  },
  {
    documentation: 'line number filter',
    label: 'sed:filter-by-line-number',
    insertText:
      "sed ${1|--regexp-extended,-E|} ${2|--quiet,-n|} '${3:number}p' ${4:path/to/file}",
  },
  {
    documentation: 'line number filter',
    label: 'sed:filter-by-line-numbers',
    insertText:
      "sed ${1|--regexp-extended,-E|} ${2|--quiet,-n|} '${3:from},${4:to}p' ${5:path/to/file}",
  },
  {
    documentation: 'single replacement',
    label: 'sed:replace-first',
    insertText:
      "sed ${1|--regexp-extended,-E|} 's/${2:pattern}/${3:replacement}/' ${4:path/to/file}",
  },
  {
    documentation: 'global replacement',
    label: 'sed:replace-all',
    insertText:
      "sed ${1|--regexp-extended,-E|} 's/${2:pattern}/${3:replacement}/g' ${4:path/to/file}",
  },
  {
    documentation: 'transliteration',
    label: 'sed:transliterate',
    insertText:
      "sed ${1|--regexp-extended,-E|} 'y/${2:source-characters}/${3:replacement-characters}/g' ${4:path/to/file}",
  },
  {
    documentation: 'whole file read',
    label: 'sed:read-all',
    insertText:
      "sed ${1|--regexp-extended,-E|} ':${2:x} N $! b$2 ${3:command}' ${4:path/to/file}",
  },
  {
    documentation: 'line print',
    label: 'awk:print',
    insertText: "awk '/./' ${1:path/to/file}",
  },
  {
    documentation: 'line pattern filter',
    label: 'awk:filter-by-line-pattern',
    insertText: "awk '/${1:pattern}/' ${2:path/to/file}",
  },
  {
    documentation: 'line number filter',
    label: 'awk:filter-by-line-number',
    insertText: "awk 'NR == ${1:number}' ${2:path/to/file}",
  },
  {
    documentation: 'line number filter',
    label: 'awk:filter-by-line-numbers',
    insertText: "awk 'NR >= ${1:from} && NR <= ${2:to}' ${3:path/to/file}",
  },
  {
    documentation: 'single replacement',
    label: 'awk:replace-first',
    insertText: 'awk \'{ sub("${1:pattern}", "${2:replacement}") }\' ${3:path/to/file}',
  },
  {
    documentation: 'global replacement',
    label: 'awk:replace-all',
    insertText: 'awk \'{ gsub("${1:pattern}", "${2:replacement}") }\' ${3:path/to/file}',
  },
  {
    documentation: 'whole file read',
    label: 'awk:read-all',
    insertText: "awk RS='^$' '{ ${1:command} }' ${2:path/to/file}",
  },
  {
    documentation: 'node print',
    label: 'jq:print',
    insertText: "jq '.${1:path/to/node}' ${2:path/to/file}",
  },
  {
    documentation: 'node print',
    label: 'yq:print',
    insertText: "yq '.${1:path/to/node}' ${2:path/to/file}",
  },
  {
    documentation: 'home directory',
    label: '~',
    insertText: '$HOME',
  },
  {
    documentation: '[dev]ice name',
    label: 'dev',
    insertText: '/dev/${1|null,stdin,stdout,stderr|}',
  },
  {
    documentation: '[al]pha[num]eric characters',
    label: 'alnum',
    insertText: '[[:alnum:]]',
  },
  {
    documentation: '[alpha]betic characters',
    label: 'alpha',
    insertText: '[[:alpha:]]',
  },
  {
    documentation: '[blank] characters',
    label: 'blank',
    insertText: '[[:blank:]]',
  },
  {
    documentation: '[c]o[nt]ro[l] characters',
    label: 'cntrl',
    insertText: '[[:cntrl:]]',
  },
  {
    documentation: '[digit] characters',
    label: 'digit',
    insertText: '[[:digit:]]',
  },
  {
    documentation: '[graph]ical characters',
    label: 'graph',
    insertText: '[[:graph:]]',
  },
  {
    documentation: '[lower] characters',
    label: 'lower',
    insertText: '[[:lower:]]',
  },
  {
    documentation: '[print]able characters',
    label: 'print',
    insertText: '[[:print:]]',
  },
  {
    documentation: '[punct]uation characters',
    label: 'punct',
    insertText: '[[:punct:]]',
  },
  {
    documentation: '[space] characters',
    label: 'space',
    insertText: '[[:space:]]',
  },
  {
    documentation: '[upper] characters',
    label: 'upper',
    insertText: '[[:upper:]]',
  },
  {
    documentation: 'hexadecimal characters',
    label: 'xdigit',
    insertText: '[[:xdigit:]]',
  },
].map((item) => ({
  ...item,
  documentation: {
    value: [
      markdownBlock(
        `${item.documentation || item.label} (bash-language-server)\n\n`,
        'man',
      ),
      markdownBlock(item.insertText, 'bash'),
    ].join('\n'),
    kind: MarkupKind.Markdown,
  },

  insertTextFormat: InsertTextFormat.Snippet,
  data: {
    type: CompletionItemDataType.Snippet,
  },
  kind: CompletionItemKind.Snippet,
}))

function markdownBlock(text: string, language: string): string {
  const tripleQoute = '```'
  return [tripleQoute + language, text, tripleQoute].join('\n')
}
