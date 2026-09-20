import { afterAll, beforeAll, expect, it } from 'vitest'
import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Parser } from 'web-tree-sitter'

import { getMockConnection } from '../../../testing/mocks'
import Analyzer from '../analyser'
import { initializeParser } from '../parser'
import BashServer from '../server'
import { getGlobalDeclarations } from '../util/declarations'

const uri = 'file:///input-declarations.sh'
let parser: Parser
beforeAll(async () => {
  parser = await initializeParser()
})
afterAll(() => parser.delete())

function analyze(source: string) {
  const analyzer = new Analyzer({ parser, workspaceFolder: null })
  const document = TextDocument.create(uri, 'shellscript', 1, source)
  analyzer.analyze({ uri, document })
  return { analyzer, document }
}

it.each([
  'read name',
  'read -rp "name" name',
  'read -a name ignored',
  'read name -a ignored',
  'read -raname ignored',
  'read "name"',
  "read 'name'",
  'readarray -td: name <<<"$2"',
  'mapfile -t name < <(printf x)',
  'mapfile -n 2 -O0 -s1 -u 3 -C name -c 2 name',
])('uses the same destination for all symbol consumers: %s', (command) => {
  const { analyzer, document } = analyze(`${command}\necho $name`)
  const symbols = analyzer.getAllVariables({ uri, position: { line: 1, character: 9 } })
  expect(symbols.map((s) => s.name)).toEqual(['name'])
  const { location } = symbols[0]
  expect(document.getText(location.range)).toBe('name')
  expect(analyzer.getDeclarationsForUri({ uri }).map((s) => s.name)).toEqual(['name'])
  const symbol = analyzer.symbolAtPointFromTextPosition({
    textDocument: { uri },
    position: location.range.start,
  })
  expect(symbol).toEqual({
    word: 'name',
    kind: LSP.SymbolKind.Variable,
    range: location.range,
  })
  expect(analyzer.wordAtPoint(uri, 0, location.range.start.character)).toBe('name')
  expect(
    analyzer.findOriginalDeclaration({
      uri,
      word: 'name',
      kind: LSP.SymbolKind.Variable,
      position: { line: 1, character: 9 },
    }).declaration,
  ).toEqual(location)
  expect(
    analyzer.findOccurrencesWithin({ uri, word: 'name', kind: LSP.SymbolKind.Variable }),
  ).toEqual([location.range, LSP.Range.create(1, 6, 1, 10)])
  expect(analyzer.findReferences('name').map((l) => l.range)).toEqual([
    location.range,
    LSP.Range.create(1, 6, 1, 10),
  ])
})

it.each([
  'read',
  'mapfile',
  'read -p name',
  'read --help name',
  'mapfile -Z name',
  'read "$options" name',
  'mapfile "$destination"',
  'echo read name',
  'read -a "$destination" name',
  'read -d',
  'read -p $options name',
  'mapfile -C $options name',
])('does not invent destinations for unsupported input: %s', (command) => {
  const { analyzer } = analyze(`${command}\necho $name`)
  expect(analyzer.getAllVariables({ uri, position: { line: 1, character: 9 } })).toEqual(
    [],
  )
})

it('keeps input assignments to a proven local inside its function', () => {
  const { analyzer } = analyze(
    'f() {\n local name\n readarray -t name\n echo $name\n}\necho $name',
  )
  expect(analyzer.getAllVariables({ uri, position: { line: 5, character: 9 } })).toEqual(
    [],
  )
  expect(
    analyzer
      .getAllVariables({ uri, position: { line: 3, character: 9 } })
      .map((s) => s.name),
  ).toEqual(['name'])
  expect(
    analyzer.findOriginalDeclaration({
      uri,
      word: 'name',
      kind: LSP.SymbolKind.Variable,
      position: { line: 3, character: 9 },
    }).declaration?.range,
  ).toEqual(LSP.Range.create(1, 7, 1, 11))
})

it.each(['read name', 'mapfile "name"', "readarray 'name'"])(
  'does not bind an earlier same-line reference to a later input: %s',
  (command) => {
    const source = `echo "$name"; ${command}; echo "$name"`
    const { analyzer, document } = analyze(source)
    const lookup = (offset: number) =>
      analyzer.findOriginalDeclaration({
        uri,
        word: 'name',
        kind: LSP.SymbolKind.Variable,
        position: document.positionAt(offset),
      }).declaration
    const before = document.positionAt(source.indexOf('$name') + 1)
    expect(lookup(source.indexOf('$name') + 1)).toBeNull()
    expect(
      analyzer.findDeclarationLocations({ uri, word: 'name', position: before }),
    ).toEqual([])
    const start = source.indexOf(command) + command.indexOf('name')
    const expected = LSP.Location.create(
      uri,
      LSP.Range.create(document.positionAt(start), document.positionAt(start + 4)),
    )
    expect(lookup(start)).toEqual(expected)
    expect(lookup(source.lastIndexOf('$name') + 1)).toEqual(expected)
    expect(
      analyzer.findDeclarationLocations({
        uri,
        word: 'name',
        position: document.positionAt(source.lastIndexOf('$name') + 1),
      }),
    ).toEqual([expected])
  },
)

it.each([
  'printf x | mapfile name',
  'echo "$(read name)"',
  'echo "$(mapfile name <<< "$name"; echo "$name")"',
  'cat <(readarray name)',
  'mapfile name &',
])('declines input declarations in unsupported execution contexts: %s', (command) => {
  const source = `${command}\necho $name`
  const { analyzer } = analyze(source)
  const tree = parser.parse(source)!
  try {
    expect(getGlobalDeclarations({ tree, uri })).toEqual({})
    expect(analyzer.getDeclarationsForUri({ uri })).toEqual([])
    expect(
      analyzer.getAllVariables({ uri, position: { line: 1, character: 9 } }),
    ).toEqual([])
    expect(
      analyzer.symbolAtPointFromTextPosition({
        textDocument: { uri },
        position: { line: 0, character: command.indexOf('name') },
      }),
    ).toBeNull()
    expect(
      analyzer.findOriginalDeclaration({
        uri,
        word: 'name',
        kind: LSP.SymbolKind.Variable,
        position: { line: 1, character: 9 },
      }).declaration,
    ).toBeNull()
  } finally {
    tree.delete()
  }
})

it('keeps explicit subshell navigation without exporting its input destinations', () => {
  const source = '(mapfile name; echo $name)\necho $name'
  const { analyzer } = analyze(source)
  const tree = parser.parse(source)!
  try {
    expect(getGlobalDeclarations({ tree, uri })).toEqual({})
    const result = analyzer.findOriginalDeclaration({
      uri,
      word: 'name',
      kind: LSP.SymbolKind.Variable,
      position: { line: 0, character: 22 },
    })
    expect(result.declaration?.range).toEqual(LSP.Range.create(0, 9, 0, 13))
    expect(
      analyzer.findOccurrencesWithin({
        uri,
        word: 'name',
        kind: LSP.SymbolKind.Variable,
        scope: result.parent!.range,
      }),
    ).toEqual([LSP.Range.create(0, 9, 0, 13), LSP.Range.create(0, 21, 0, 25)])
    expect(
      analyzer.findOriginalDeclaration({
        uri,
        word: 'name',
        kind: LSP.SymbolKind.Variable,
        position: { line: 1, character: 9 },
      }).declaration,
    ).toBeNull()
  } finally {
    tree.delete()
  }
})

it('provides hover documentation for a readarray declaration', async () => {
  const connection = getMockConnection()
  const server = await BashServer.initialize(connection, {
    rootPath: null,
    rootUri: null,
    processId: 42,
    capabilities: {},
    workspaceFolders: null,
    initializationOptions: { backgroundAnalysisMaxFiles: 0, shellcheckPath: '' },
  })
  server.register(connection)
  await connection.onInitialized.mock.calls[0][0]({})
  await server.analyzeAndLintDocument(
    TextDocument.create(
      uri,
      'shellscript',
      1,
      '# Collected input\nreadarray -t name\necho $name',
    ),
  )
  const hover = await connection.onHover.mock.calls[0][0](
    { textDocument: { uri }, position: { line: 2, character: 8 } },
    {} as any,
    {} as any,
    undefined,
  )
  expect(hover).toMatchObject({
    contents: { value: expect.stringContaining('Variable: **name**') },
  })
})
