import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from '../analyser'
import { initializeParser } from '../parser'

const uri = 'file:///local-variable-completion.sh'

async function variables(source: string, line = source.split('\n').length - 1) {
  const parser = await initializeParser()
  try {
    const analyzer = new Analyzer({ parser, workspaceFolder: null })
    analyzer.analyze({
      uri,
      document: TextDocument.create(uri, 'shellscript', 1, source),
    })
    return analyzer.getAllVariables({ uri, position: { line, character: 6 } })
  } finally {
    parser.delete()
  }
}

it.each(['local', 'declare', 'typeset', 'local -a', 'declare +g'])(
  'keeps reassigned %s variables inside their function',
  async (command) => {
    const source = `f() {\n  ${command} var=value\n  var=changed\n}\necho $var`
    expect(await variables(source)).toEqual([])
    expect((await variables(source, 2)).map((symbol) => symbol.name)).toContain('var')
  },
)

it('preserves global assignments before a same-line local declaration', async () => {
  const source = 'f() { var=global; local var; var=local; }\necho $var'
  const symbols = await variables(source)
  expect(symbols).toHaveLength(1)
  expect(symbols[0].location.range.start.character).toBe(6)
})

it.each(['local first second', 'local first=value second=other'])(
  'keeps every local available after a nested reassignment: %s',
  async (declaration) => {
    const source = `f() {\n ${declaration}\n if true; then first=changed; second=changed; fi\n echo $first $second\n}\necho $first $second`
    expect((await variables(source, 3)).map((symbol) => symbol.name).sort()).toEqual([
      'first',
      'second',
    ])
    expect(await variables(source)).toEqual([])
  },
)

it('retains an earlier global and ignores a later local reassignment', async () => {
  const source = 'var=global\nf() { local var; var=local; }\necho $var'
  expect(
    (await variables(source)).map((symbol) => symbol.location.range.start.line),
  ).toEqual([0])
})

it('does not apply a local declaration to a different function', async () => {
  const source = 'f() { local var; }\ng() { var=global; }\necho $var'
  expect(
    (await variables(source)).map((symbol) => symbol.location.range.start.line),
  ).toEqual([1])
})

it.each([
  'declare -g var',
  'local -p var',
  'typeset -f var',
  'local --help var',
  'local -Z var',
  'local "$options" var',
  'if maybe; then local var; fi',
  'true && local var',
  'printf x | local var',
  '(local var)',
  'echo "$(local var)"',
  'local var &',
])('keeps uncertain or nonlocal declarations conservative: %s', async (command) => {
  const source = `f() {\n  ${command}\n  var=global\n}\necho $var`
  expect((await variables(source)).map((symbol) => symbol.name)).toContain('var')
})

it('ignores declarations inside a nested function', async () => {
  const source = 'f() { g() { local var; }; var=global; }\necho $var'
  expect((await variables(source)).map((symbol) => symbol.name)).toContain('var')
})
