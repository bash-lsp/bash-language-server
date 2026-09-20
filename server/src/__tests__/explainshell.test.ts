import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, Server } from 'node:http'
import { AddressInfo } from 'node:net'

import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from '../analyser'
import { initializeParser } from '../parser'

describe('explainshell HTTP requests', () => {
  let server: Server
  let endpoint: string
  let requestUrl: string | undefined
  let response: unknown

  beforeEach(async () => {
    requestUrl = undefined
    response = { matches: [{ start: 5, end: 10, helpHTML: '<p>Hello</p>' }] }
    server = createServer((request, reply) => {
      requestUrl = request.url
      reply.setHeader('Content-Type', 'application/json')
      reply.end(JSON.stringify(response))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  })

  async function getDocumentation() {
    const parser = await initializeParser()
    const analyzer = new Analyzer({ parser, workspaceFolder: null })
    const uri = 'file:///explainshell-test.sh'
    analyzer.analyze({
      uri,
      document: TextDocument.create(uri, 'shellscript', 1, 'echo hello'),
    })
    try {
      return await analyzer.getExplainshellDocumentation({
        endpoint,
        params: { textDocument: { uri }, position: { line: 0, character: 6 } },
      })
    } finally {
      parser.delete()
    }
  }

  it('sends the command and reads matching hover documentation', async () => {
    await expect(getDocumentation()).resolves.toEqual({ helpHTML: '<p>Hello</p>' })
    expect(requestUrl).toBe('/explain?cmd=echo+hello')
  })

  it('handles a response without matching documentation', async () => {
    response = {}
    await expect(getDocumentation()).resolves.toEqual({})
  })
})
