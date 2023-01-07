// https://www.gnu.org/software/bash/manual/html_node/Reserved-Word-Index.html

export const LIST = [
  '!',
  '[[',
  ']]',
  '{',
  '}',
  'case',
  'do',
  'done',
  'elif',
  'else',
  'esac',
  'fi',
  'for',
  'function',
  'if',
  'in',
  'select',
  'then',
  'time',
  'until',
  'while',
]

const SET = new Set(LIST)

export function isReservedWord(word: string): boolean {
  return SET.has(word)
}
