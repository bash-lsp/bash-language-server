/**
 * Naming convention for `documentation`:
 * - for Bash operators it's '<operator> operator'
 * - for Bash documentation it's 'documentation definition' or '"<documentation>" documentation definition'
 * - for Bash functions it's 'function definition' or '"<function>" function definition'
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
 * - for Bash documentation it's one of 'documentation'/'<documentation>'
 * - for Bash functions it's one of 'function'/'<function>'
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
    insertText: [
      'if [[ -n "${${1:variable}+x}" ]]; then',
      '\t${2:command ...}',
      'fi',
    ].join('\n'),
  },
  {
    label: 'if-not-defined',
    documentation: 'if with variable existence check',
    insertText: [
      'if [[ -z "${${1:variable}+x}" ]]; then',
      '\t${2:command ...}',
      'fi',
    ].join('\n'),
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
      'esac',
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
    documentation: 'block',
    label: 'block',
    insertText: ['{', '\t${1:command ...}', '}'].join('\n'),
  },
  {
    documentation: 'block redirected',
    label: 'block-redirected',
    insertText: ['{', '\t${1:command ...}', '} > ${2:file}'].join('\n'),
  },
  {
    documentation: 'block stderr redirected',
    label: 'block-stderr-redirected',
    insertText: ['{', '\t${1:command ...}', '} 2> ${2:file}'].join('\n'),
  },
  {
    documentation: 'variable',
    label: 'variable',
    insertText: 'declare ${1:variable}=${2:value}',
  },
  {
    documentation: 'variable index',
    label: 'variable-index',
    insertText: '${1:variable}[${2:index}]=${3:value}',
  },
  {
    documentation: 'variable append',
    label: 'variable-append',
    insertText: '${1:variable}+=${2:value}',
  },
  {
    documentation: 'variable-prepend',
    label: 'variable-prepend',
    insertText: '${1:variable}=${2:value}\\$$1',
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
    documentation: 'string shortest leading replacement',
    label: 'string-remove-leading',
    insertText: '"\\${${1:variable}#${2:pattern}}"',
  },
  {
    documentation: 'string shortest trailing replacement',
    label: 'string-remove-trailing',
    insertText: '"\\${${1:variable}%${2:pattern}}"',
  },
  {
    documentation: 'string filtering',
    label: 'string-match',
    insertText: "sed ${1|-E -n,--regexp-extended --quiet|} '/${2:pattern}/p'",
  },
  {
    documentation: 'string replacement',
    label: 'string-replace',
    insertText: "sed ${1|-E,--regexp-extended|} 's/${2:pattern}/${3:replacement}/'",
  },
  {
    documentation: 'string replacement',
    label: 'string-replace-all',
    insertText: "sed ${1|-E,--regexp-extended|} 's/${2:pattern}/${3:replacement}/g'",
  },
  {
    documentation: 'string transliterate',
    label: 'string-transliterate',
    insertText:
      "sed ${1|-E,--regexp-extended|} 'y/${2:source-characters}/${3:replacement-characters}/g'",
  },
  {
    documentation: 'file print',
    label: 'file-print',
    insertText: "sed '' ${1:file}",
  },
  {
    documentation: 'file read',
    label: 'file-read',
    insertText:
      "sed ${1|-E,--regexp-extended|} ':${2:x} N $! b$2 ${3:command}' ${4:file}",
  },
  {
    documentation: 'skip first',
    label: 'skip-first',
    insertText: 'tail ${1|-n,-c,--lines,--bytes|} +${2:count}',
  },
  {
    documentation: 'skip last',
    label: 'skip-last',
    insertText: 'head ${1|-n,-c,--lines,--bytes|} -${2:count}',
  },
  {
    documentation: 'take first',
    label: 'take-first',
    insertText: 'head ${1|-n,-c,--lines,--bytes|} ${2:count}',
  },
  {
    documentation: 'take last',
    label: 'take-last',
    insertText: 'tail ${1|-n,-c,--lines,--bytes|} ${2:count}',
  },
  {
    documentation: 'take range',
    label: 'take-range',
    insertText: "sed ${1|-n,--quiet|} '${2:from},${3:to}p'",
  },
  {
    documentation: 'take stepped range',
    label: 'take-stepped-range',
    insertText: "sed ${1|-n,--quiet|} '${2:from},${3:to}p' | sed $1 '1~${4:step}p'",
  },
  {
    documentation: 'json print',
    label: 'json-print',
    insertText: "jq '.${1:node}' ${2:file}",
  },
  {
    documentation: 'device',
    label: 'device',
    insertText: '/dev/${1|null,stdin,stdout,stderr|}',
  },
  {
    documentation: 'completion',
    label: 'completion definition',
    insertText: [
      '_$1_completions()',
      '{',
      '\treadarray -t COMPREPLY < <(compgen -W "-h --help -v --version" "\\${COMP_WORDS[1]}")',
      '}',
      '',
      'complete -F _$1_completions ${1:command}',
    ].join('\n'),
  },
  {
    documentation: 'comment',
    label: 'comment definition',
    insertText: '# ${1:description}',
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
