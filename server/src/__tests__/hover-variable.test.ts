import { expect, it, vi, type Mock } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { getMockConnection } from '../../../testing/mocks'
import Analyzer from '../analyser'
import LspServer from '../server'
import * as sh from '../util/sh'

it.each(
  ['source', 'alias', 'ls'].flatMap((word) =>
    [false, true].map((useExplainshell) => [word, useExplainshell] as const),
  ),
)(
  'treats %s assignments and expansions as variables (explainshell: %s)',
  async (word, useExplainshell) => {
    const documentation = vi
      .spyOn(sh, 'getShellDocumentation')
      .mockResolvedValue('command documentation')
    const explainshellDocumentation = vi
      .spyOn(Analyzer.prototype, 'getExplainshellDocumentation')
      .mockResolvedValue({ helpHTML: 'command documentation' })
    try {
      const connection = getMockConnection()
      const getConfiguration = connection.workspace.getConfiguration as Mock
      getConfiguration.mockResolvedValue({
        shellcheckPath: '',
        explainshellEndpoint: useExplainshell ? 'http://localhost:5000' : '',
      })
      const server = await LspServer.initialize(connection, {
        rootUri: null,
        processId: null,
        capabilities: { workspace: { configuration: true } },
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
      expect(explainshellDocumentation).not.toHaveBeenCalled()
      if (word !== 'ls') {
        expect(await hover(2, 1)).toEqual({
          contents: {
            kind: 'markdown',
            value: expect.stringContaining('command documentation'),
          },
        })
        expect(explainshellDocumentation).toHaveBeenCalledTimes(useExplainshell ? 1 : 0)
        expect(documentation).toHaveBeenCalledTimes(useExplainshell ? 0 : 1)
      }
    } finally {
      documentation.mockRestore()
      explainshellDocumentation.mockRestore()
    }
  },
)
