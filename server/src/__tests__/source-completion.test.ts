import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Parser } from 'web-tree-sitter'

import { initializeParser } from '../parser'
import { completeSourcePath } from '../source-completion'

let parser: Parser
beforeAll(async () => {
  parser = await initializeParser()
})
afterAll(() => parser.delete())

function complete(
  marked: string,
  files = ['/project/lib.sh'],
  uri = 'file:///project/main.sh',
) {
  const offset = marked.indexOf('¦')
  const source = marked.replace('¦', '')
  const document = TextDocument.create(uri, 'shellscript', 1, source)
  const tree = parser.parse(source)!
  try {
    const items = completeSourcePath({
      document,
      root: tree.rootNode,
      position: document.positionAt(offset),
      fileUris: () => files.map((file) => pathToFileURL(file).href),
    })
    return { items, document }
  } finally {
    tree.delete()
  }
}

it.each([
  'source ¦',
  '. ¦',
  'source ./l¦',
  'source l¦',
  'true && source ¦',
  'f() { source ¦; }',
])('completes a source argument: %s', (source) => {
  const { items } = complete(source)
  expect(items?.map((item) => item.label)).toEqual(['./lib.sh'])
  expect(items?.[0].textEdit?.newText).toBe('./lib.sh')
})

it.each([
  ['source ./l¦ong.sh tail # comment', 'source ./lib.sh tail # comment'],
  ['source "./l¦ong.sh"', 'source "./lib.sh"'],
  ["source './l¦ong.sh'", "source './lib.sh'"],
  ['source "./l¦', 'source "./lib.sh"'],
  ["source './l¦", "source './lib.sh'"],
])('replaces the full literal token: %s', (source, expected) => {
  const { items, document } = complete(source)
  expect(items).toHaveLength(1)
  expect(TextDocument.applyEdits(document, [items![0].textEdit as LSP.TextEdit])).toBe(
    expected,
  )
})

it.each([
  '# source ¦',
  'echo source ¦',
  'echo "source ¦"',
  'cat <<EOF\nsource ¦\nEOF',
  'source ./lib.sh argument¦',
  'source "./l¦\nrest.sh"',
  'source "./l¦\nrest.sh',
  'source "$DIR/l¦"',
  'source "./li"b¦',
  'source ./lib\\ name¦',
  'source ./l¦"; printf exploited; #"',
  "source ./l¦'; printf exploited; #'",
  'source "./l¦\nprintf exploited > marker\n"',
  'source "./l¦\nprintf exploited > marker\n',
  'printf "😀é source ./l¦"',
])('does not offer file edits outside supported literal arguments: %s', (source) => {
  expect(complete(source).items).toBeNull()
})

it.each(['é', '😀', '😀é'])(
  'uses UTF-16 positions without modifying adjacent Unicode text: %s',
  (prefix) => {
    const { items, document } = complete(`printf '${prefix}'; source "./l¦ong.sh" tail`)
    expect(items).toHaveLength(1)
    expect(TextDocument.applyEdits(document, [items![0].textEdit as LSP.TextEdit])).toBe(
      `printf '${prefix}'; source "./lib.sh" tail`,
    )
  },
)

it('uses portable relative paths, excludes the current file, and filters the prefix', () => {
  const { items } = complete('source ../¦', [
    '/project/main.sh',
    '/shared.sh',
    '/project/lib.sh',
  ])
  expect(items?.map((item) => item.label)).toEqual(['../shared.sh'])
  expect(items?.[0].textEdit?.newText).toBe('../shared.sh')
})

it.each(['', '"', "'"])('shell-quotes special filenames with %s quoting', (quote) => {
  const filename = 'space $cash `printf bad` $(printf bad) "quote" apostrophe\'.sh'
  const { items } = complete(`source ${quote}¦${quote}`, [`/project/${filename}`])
  expect(items).toHaveLength(1)
  const inserted = items![0].textEdit!.newText
  // Interpreting only the generated argument must yield the literal path.
  expect(
    execFileSync('/bin/bash', ['-c', `printf '%s' ${inserted}`], { encoding: 'utf8' }),
  ).toBe(`./${filename}`)
})

it('does not offer filesystem paths in an untitled document', () => {
  expect(
    complete('source ¦', ['/project/lib.sh'], 'untitled:Untitled-1').items,
  ).toBeNull()
})

it('does not request the workspace catalog outside a source argument', () => {
  const text = 'echo value\n'.repeat(1000)
  const document = TextDocument.create('file:///project/main.sh', 'shellscript', 1, text)
  const tree = parser.parse(text)!
  const fileUris = jest.fn(() => ['file:///project/lib.sh'])
  try {
    expect(
      completeSourcePath({
        document,
        root: tree.rootNode,
        position: { line: 999, character: 10 },
        fileUris,
      }),
    ).toBeNull()
    expect(fileUris).not.toHaveBeenCalled()
  } finally {
    tree.delete()
  }
})
