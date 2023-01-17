/**
 * Naming convention for `label`:
 * - is always a language keyword, builtin name or expansion symbol like `:-`.
 * - If a snippet is for a builtin then builtin name is used.
 * - If a snippet is for expansion then expansion symbol is used.
 * - If a snippet is for a specific external program like **awk** then program name must be added to `prefix` like this:
 *  `awk:{{snippet-prefix}}`.
 */
import { CompletionItemKind, InsertTextFormat, MarkupKind } from 'vscode-languageserver'

import { BashCompletionItem } from './types'

export const SNIPPETS: BashCompletionItem[] = [
  {
    label: 'shebang',
    insertText: '#!/usr/bin/env ${1|bash,sh|}',
  },
  {
    label: 'if',
    insertText: ['if ${1:command}; then', '\t$0', 'fi'].join('\n'),
  },
  {
    label: 'if-else',
    insertText: ['if ${1:command}; then', '\t${2:echo}', 'else', '\t$0', 'fi'].join('\n'),
  },
  {
    label: 'while',
    insertText: ['while ${1:command}; do', '\t$0', 'done'].join('\n'),
  },
  {
    label: 'until',
    insertText: ['until ${1:command}; do', '\t$0', 'done'].join('\n'),
  },
  {
    label: 'for',
    insertText: ['for ${1:variable} in ${2:list}; do', '\t$0', 'done'].join('\n'),
  },
  {
    label: 'function',
    insertText: ['${1:function_name}() {', '\t$0', '}'].join('\n'),
  },
  {
    label: 'main',
    insertText: ['main() {', '\t$0', '}'].join('\n'),
  },
  {
    documentation: '[:-] expansion',
    label: ':-',
    insertText: '"\\${${1:variable}:-${2:default}}"',
  },
  {
    documentation: '[:=] expansion',
    label: ':=',
    insertText: '"\\${${1:variable}:=${2:default}}"',
  },
  {
    documentation: '[:?] expansion',
    label: ':?',
    insertText: '"\\${${1:variable}:?${2:error_message}}"',
  },
  {
    documentation: '[:+] expansion',
    label: ':+',
    insertText: '"\\${${1:variable}:+${2:alternative}}"',
  },
  {
    documentation: '[#] expansion',
    label: '#',
    insertText: '"\\${${1:variable}#${2:pattern}}"',
  },
  {
    documentation: '[##] expansion',
    label: '##',
    insertText: '"\\${${1:variable}##${2:pattern}}"',
  },
  {
    documentation: '[%] expansion',
    label: '%',
    insertText: '"\\${${1:variable}%${2:pattern}}"',
  },
  {
    documentation: '[%%] expansion',
    label: '%%',
    insertText: '"\\${${1:variable}%%${2:pattern}}"',
  },
  {
    documentation: '[..] brace expansion',
    label: '..',
    insertText: '{${1:from}..${2:to}}',
  },
  {
    label: 'echo',
    insertText: 'echo "${1:message}"',
  },
  {
    label: 'printf',
    insertText: 'printf \'%s\' "${1:message}"',
  },
  {
    label: 'source',
    insertText: 'source "${1:path/to/file}"',
  },
  {
    label: 'alias',
    insertText: 'alias ${1:name}=${2:value}',
  },
  {
    label: 'cd',
    insertText: 'cd "${1:path/to/directory}"',
  },
  {
    label: 'getopts',
    insertText: 'getopts ${1:optstring} ${2:name}',
  },
  {
    label: 'jobs',
    insertText: 'jobs -x ${1:command}',
  },
  {
    label: 'kill',
    insertText: 'kill ${1|-l,-L|}',
  },
  {
    label: 'let',
    insertText: 'let ${1:argument}',
  },
  {
    label: 'test',
    insertText:
      '[[ ${1:argument1} ${2|-ef,-nt,-ot,==,=,!=,=~,<,>,-eq,-ne,-lt,-le,-gt,-ge|} ${3:argument2} ]]',
  },
  {
    documentation: '[dev]ice name',
    label: 'dev',
    insertText: '/dev/${1|null,stdin,stdout,stderr|}',
  },
  {
    label: 'sed:filter-lines',
    insertText:
      "sed ${1|--regexp-extended,-E|} ${2|--quiet,-n|} '/${3:pattern}/' ${4:path/to/file}",
  },
  {
    label: 'awk:filter-lines',
    insertText: "awk '/${1:pattern}/' ${2:path/to/file}",
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
    type: CompletionItemKind.Snippet,
  },
}))

function markdownBlock(text: string, language: string): string {
  const tripleQoute = '```'
  return [tripleQoute + language, text, tripleQoute].join('\n')
}
