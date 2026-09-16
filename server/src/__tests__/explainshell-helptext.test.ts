import { createServer, Server } from 'node:http'
import { AddressInfo } from 'node:net'

import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from '../analyser'
import { initializeParser } from '../parser'

// Response schema reported in issue #1107 and returned by explainshell-api.
const apiResponse = {
  getargs: 'ls -l',
  helptext: [
    ['list directory contents', 'help-0'],
    ['<b>-l</b> use a long listing format', 'help-1'],
  ],
  matches: [
    { start: 0, end: 2, helpclass: 'help-0', match: 'ls' },
    { start: 3, end: 5, helpclass: 'help-1', match: '-l' },
  ],
  status: 'success',
}

describe('explainshell helptext responses', () => {
  let server: Server
  let endpoint: string
  let response: unknown

  beforeEach(async () => {
    response = apiResponse
    server = createServer((_request, reply) => {
      reply.setHeader('Content-Type', 'application/json')
      reply.end(JSON.stringify(response))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  async function getDocumentation(character: number) {
    const parser = await initializeParser()
    try {
      const analyzer = new Analyzer({ parser, workspaceFolder: null })
      const uri = 'file:///explainshell-helptext.sh'
      analyzer.analyze({
        uri,
        document: TextDocument.create(uri, 'shellscript', 1, 'ls -l'),
      })
      return await analyzer.getExplainshellDocumentation({
        endpoint,
        params: { textDocument: { uri }, position: { line: 0, character } },
      })
    } finally {
      parser.delete()
    }
  }

  it('resolves command and flag documentation through helpclass', async () => {
    await expect(getDocumentation(0)).resolves.toEqual({
      helpHTML: 'list directory contents',
    })
    await expect(getDocumentation(3)).resolves.toEqual({
      helpHTML: '<b>-l</b> use a long listing format',
    })
  })

  it('prefers inline documentation when both formats are present', async () => {
    response = {
      ...apiResponse,
      matches: [{ start: 0, end: 2, helpclass: 'help-0', helpHTML: '<p>Inline</p>' }],
    }
    await expect(getDocumentation(0)).resolves.toEqual({ helpHTML: '<p>Inline</p>' })
  })

  it('does not borrow documentation from a different match', async () => {
    response = { ...apiResponse, matches: [{ start: 0, end: 2, helpclass: 'unknown' }] }
    await expect(getDocumentation(0)).resolves.toEqual({ helpHTML: undefined })
    await expect(getDocumentation(3)).resolves.toEqual({ helpHTML: undefined })
  })
})
