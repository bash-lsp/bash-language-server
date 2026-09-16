import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from '../analyser'
import { initializeParser } from '../parser'

const uri = 'file:///forward-definitions.sh'

async function findDefinition(source: string, word: string, line: number) {
  const analyzer = new Analyzer({
    parser: await initializeParser(),
    workspaceFolder: null,
  })
  analyzer.analyze({
    uri,
    document: TextDocument.create(uri, 'shellscript', 1, source),
  })
  return analyzer.findDeclarationLocations({
    uri,
    word,
    position: { line, character: source.split('\n')[line].indexOf(word) + 1 },
  })
}

describe('forward function definitions', () => {
  it('finds a later function called from a function body', async () => {
    const source = [
      'function foo {',
      '  bar',
      '}',
      'function bar {',
      '  echo in bar',
      '}',
      'foo',
    ].join('\n')
    expect(await findDefinition(source, 'bar', 1)).toEqual([
      {
        uri,
        range: { start: { line: 3, character: 0 }, end: { line: 5, character: 1 } },
      },
    ])
  })

  it('prefers the latest preceding definition over a later redefinition', async () => {
    const source = 'bar() { :; }\nbar() { :; }\nbar\nbar() { :; }'
    const locations = await findDefinition(source, 'bar', 2)
    expect(locations.map((location) => location.range.start.line)).toEqual([1])
  })

  it('uses the first later definition when no preceding definition exists', async () => {
    const source = 'foo() {\n bar\n}\nbar() { :; }\nbar() { :; }'
    const locations = await findDefinition(source, 'bar', 1)
    expect(locations.map((location) => location.range.start.line)).toEqual([3])
  })

  it('does not expose variables assigned after their use', async () => {
    expect(await findDefinition('echo "$later"\nlater=value', 'later', 0)).toEqual([])
  })
})

it('does not resolve a variable expansion to a later function', async () => {
  const source = 'foo() {\n echo "$bar"\n}\nbar() { :; }'
  const analyzer = new Analyzer({
    parser: await initializeParser(),
    workspaceFolder: null,
  })
  analyzer.analyze({ uri, document: TextDocument.create(uri, 'shellscript', 1, source) })
  expect(
    analyzer.findDeclarationLocations({
      uri,
      word: 'bar',
      position: { line: 1, character: 9 },
    }),
  ).toEqual([])
})

it('does not resolve a call to a later definition in the same function body', async () => {
  expect(await findDefinition('foo() {\n bar\n bar() { :; }\n}\nfoo', 'bar', 1)).toEqual(
    [],
  )
})

it('does not expose functions before a top-level call', async () => {
  expect(await findDefinition('bar\nbar() { :; }', 'bar', 0)).toEqual([])
})
