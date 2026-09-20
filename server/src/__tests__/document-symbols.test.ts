import { describe, expect, it } from 'vitest'
import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from '../analyser'
import { initializeParser } from '../parser'

async function symbolsFor(source: string) {
  const uri = 'file:///document-symbols.sh'
  const analyzer = new Analyzer({
    parser: await initializeParser(),
    workspaceFolder: null,
  })
  analyzer.analyze({
    uri,
    document: TextDocument.create(uri, 'shellscript', 1, source),
  })
  return analyzer.getDeclarationsForUri({ uri })
}

describe('document symbols', () => {
  it('lists a reassigned variable only once within its function', async () => {
    const symbols = await symbolsFor(
      [
        'add_log_entry() {',
        '  local log_level=info',
        '  if test "$1"; then',
        '    log_level=warning',
        '  else',
        '    log_level=error',
        '  fi',
        '}',
      ].join('\n'),
    )
    expect(symbols.map(({ name, containerName }) => ({ name, containerName }))).toEqual([
      { name: 'add_log_entry', containerName: undefined },
      { name: 'log_level', containerName: 'add_log_entry' },
    ])
    expect(symbols[1].location.range.start.line).toBe(1)
  })

  it('keeps same-named variables from different functions and the global scope', async () => {
    const symbols = await symbolsFor(
      [
        'value=global',
        'value=changed',
        'first() { local value=first; value=changed; }',
        'second() { local value=second; value=changed; }',
      ].join('\n'),
    )
    expect(
      symbols
        .filter((symbol) => symbol.kind === LSP.SymbolKind.Variable)
        .map((symbol) => symbol.containerName),
    ).toEqual([undefined, 'first', 'second'])
  })

  it('keeps separate definitions of the same function and their variables', async () => {
    const symbols = await symbolsFor('f() { local value=1; }\nf() { local value=2; }')
    expect(symbols.map((symbol) => symbol.name)).toEqual(['f', 'value', 'f', 'value'])
  })
})
