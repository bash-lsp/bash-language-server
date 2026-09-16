import { TextDocument } from 'vscode-languageserver-textdocument'

import { getMockConnection } from '../../../testing/mocks'
import LspServer from '../server'
import * as sh from '../util/sh'

it.each(['source', 'alias', 'ls'])(
  'treats %s assignments and expansions as variables',
  async (word) => {
    const documentation = jest
      .spyOn(sh, 'getShellDocumentation')
      .mockResolvedValue('command documentation')
    try {
      const connection = getMockConnection()
      const server = await LspServer.initialize(connection, {
        rootUri: null,
        processId: null,
        capabilities: {},
        initializationOptions: { shellcheckPath: '' },
      })
      server.register(connection)
      await connection.onInitialized.mock.calls[0][0]({})
      const document = TextDocument.create(
        'file:///hover-variable.sh',
        'shellscript',
        1,
        `${word}=value\necho $${word}\n${word} argument\n`,
      )
      await server.analyzeAndLintDocument(document)
      const hover = (line: number, character: number) =>
        connection.onHover.mock.calls[0][0](
          { textDocument: { uri: document.uri }, position: { line, character } },
          {} as any,
          {} as any,
        )

      expect(await hover(0, 1)).toBeNull()
      expect(await hover(1, 7)).toEqual({
        contents: {
          kind: 'markdown',
          value: expect.stringContaining(`Variable: **${word}**`),
        },
      })
      expect(documentation).not.toHaveBeenCalled()
      if (word !== 'ls') {
        expect(await hover(2, 1)).toEqual({
          contents: {
            kind: 'markdown',
            value: expect.stringContaining('command documentation'),
          },
        })
      }
    } finally {
      documentation.mockRestore()
    }
  },
)
