import * as Process from 'node:child_process'
import * as Path from 'node:path'
import { pathToFileURL } from 'node:url'

import * as LSP from 'vscode-languageserver/node'
import { CodeAction } from 'vscode-languageserver/node'

import {
  FIXTURE_DOCUMENT,
  FIXTURE_FOLDER,
  FIXTURE_URI,
  REPO_ROOT_FOLDER,
} from '../../../testing/fixtures'
import { getMockConnection } from '../../../testing/mocks'
import LspServer from '../server'
import { CompletionItemDataType } from '../types'

async function initializeServer(
  { rootPath }: { rootPath?: string } = { rootPath: pathToFileURL(FIXTURE_FOLDER).href },
) {
  const diagnostics: Array<LSP.PublishDiagnosticsParams | undefined> = []

  const connection = getMockConnection()

  const server = await LspServer.initialize(connection, {
    rootPath,
    rootUri: null,
    processId: 42,
    capabilities: {} as any,
    workspaceFolders: null,
  })

  server.register(connection)
  const onInitialized = connection.onInitialized.mock.calls[0][0]
  const { backgroundAnalysisCompleted } = (await onInitialized({})) as any
  await backgroundAnalysisCompleted

  return {
    connection,
    console,
    diagnostics,
    server,
  }
}

describe('server', () => {
  it('initializes and responds to capabilities', async () => {
    const { server } = await initializeServer()
    expect(server.capabilities()).toMatchSnapshot()
  })

  it('register LSP connection', async () => {
    const { connection } = await initializeServer()

    expect(connection.onHover).toHaveBeenCalledTimes(1)
    expect(connection.onDefinition).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onWorkspaceSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentHighlight).toHaveBeenCalledTimes(1)
    expect(connection.onReferences).toHaveBeenCalledTimes(1)
    expect(connection.onCompletion).toHaveBeenCalledTimes(1)
    expect(connection.onCompletionResolve).toHaveBeenCalledTimes(1)
    expect(connection.onCodeAction).toHaveBeenCalledTimes(1)
  })

  it('responds to onHover', async () => {
    const { connection } = await initializeServer()

    const onHover = connection.onHover.mock.calls[0][0]

    const result = await onHover(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          line: 25,
          character: 5,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toBeDefined()
    expect(result).toEqual({
      contents: {
        kind: 'markdown',
        value: expect.stringContaining('remove directories'),
      },
    })
  })

  it('responds to onHover with function documentation extracted from comments', async () => {
    const { connection } = await initializeServer()

    const onHover = connection.onHover.mock.calls[0][0]

    const result = await onHover(
      {
        textDocument: {
          uri: FIXTURE_URI.COMMENT_DOC,
        },
        position: {
          line: 17,
          character: 0,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toBeDefined()
    expect(result).toMatchInlineSnapshot(`
      Object {
        "contents": Object {
          "kind": "markdown",
          "value": "Function: **hello_world** - *defined on line 8*

      \`\`\`txt
      this is a comment
      describing the function
      hello_world
      this function takes two arguments
      \`\`\`",
        },
      }
    `)
  })

  it('responds to onDefinition', async () => {
    const { connection } = await initializeServer()

    const onDefinition = connection.onDefinition.mock.calls[0][0]

    const result = await onDefinition(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
        position: { character: 10, line: 2 },
      },
      {} as any,
      {} as any,
    )

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "range": Object {
            "end": Object {
              "character": 0,
              "line": 0,
            },
            "start": Object {
              "character": 0,
              "line": 0,
            },
          },
          "uri": "file://${FIXTURE_FOLDER}extension.inc",
        },
      ]
    `)
  })

  it('responds to onDocumentSymbol', async () => {
    const { connection } = await initializeServer()

    const onDocumentSymbol = connection.onDocumentSymbol.mock.calls[0][0]

    const result = await onDocumentSymbol(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 16,
                "line": 10,
              },
              "start": Object {
                "character": 0,
                "line": 10,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}sourcing.sh",
          },
          "name": "BOLD",
        },
      ]
    `)
  })

  it('responds to onDocumentHighlight', async () => {
    const { connection } = await initializeServer()

    const onDocumentHighlight = connection.onDocumentHighlight.mock.calls[0][0]

    const result1 = await onDocumentHighlight(
      {
        textDocument: {
          uri: FIXTURE_URI.ISSUE206,
        },
        position: {
          // FOO
          line: 0,
          character: 10,
        },
      },
      {} as any,
      {} as any,
    )

    // TODO: there is a superfluous range here on line 0:
    expect(result1).toMatchInlineSnapshot(`
      Array [
        Object {
          "range": Object {
            "end": Object {
              "character": 12,
              "line": 0,
            },
            "start": Object {
              "character": 9,
              "line": 0,
            },
          },
        },
        Object {
          "range": Object {
            "end": Object {
              "character": 12,
              "line": 0,
            },
            "start": Object {
              "character": 9,
              "line": 0,
            },
          },
        },
        Object {
          "range": Object {
            "end": Object {
              "character": 28,
              "line": 1,
            },
            "start": Object {
              "character": 25,
              "line": 1,
            },
          },
        },
      ]
    `)

    const result2 = await onDocumentHighlight(
      {
        textDocument: {
          uri: FIXTURE_URI.ISSUE206,
        },
        position: {
          // readonly cannot be parsed as a word
          line: 0,
          character: 0,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result2).toMatchInlineSnapshot(`Array []`)
  })

  it('responds to onWorkspaceSymbol', async () => {
    const { connection } = await initializeServer()

    const onWorkspaceSymbol = connection.onWorkspaceSymbol.mock.calls[0][0]

    async function lookupAndExpectNpmConfigLoglevelResult(query: string) {
      const result = await onWorkspaceSymbol(
        {
          query,
        },
        {} as any,
        {} as any,
      )

      expect(result).toEqual([
        {
          kind: expect.any(Number),
          location: {
            range: {
              end: { character: 27, line: 40 },
              start: { character: 0, line: 40 },
            },
            uri: expect.stringContaining('/testing/fixtures/install.sh'),
          },
          name: 'npm_config_loglevel',
        },
        {
          kind: expect.any(Number),
          location: {
            range: {
              end: { character: 31, line: 48 },
              start: { character: 2, line: 48 },
            },
            uri: expect.stringContaining('/testing/fixtures/install.sh'),
          },
          name: 'npm_config_loglevel',
        },
      ])
    }

    await lookupAndExpectNpmConfigLoglevelResult('npm_config_loglevel') // exact
    await lookupAndExpectNpmConfigLoglevelResult('config_log') // in the middle
    await lookupAndExpectNpmConfigLoglevelResult('npmloglevel') // fuzzy
  })

  it('responds to onCompletion with filtered list when word is found', async () => {
    const { connection } = await initializeServer()

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          // rm
          line: 25,
          character: 5,
        },
      },
      {} as any,
      {} as any,
    )

    // Limited set (not using snapshot due to different executables on CI and locally)
    expect(result && 'length' in result && result.length < 8).toBe(true)
    expect(result).toEqual(
      expect.arrayContaining([
        {
          data: {
            name: 'rm',
            type: CompletionItemDataType.Executable,
          },
          kind: expect.any(Number),
          label: 'rm',
        },
      ]),
    )
  })

  it('responds to onCompletion with options list when command name is found', async () => {
    // This doesn't work on all hosts:
    const getOptionsResult = Process.spawnSync(
      Path.join(__dirname, '../src/get-options.sh'),
      ['find', '-'],
    )

    if (getOptionsResult.status !== 0) {
      console.warn('Skipping onCompletion test as get-options.sh failed')
      return
    }

    const { connection } = await initializeServer()

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.OPTIONS,
        },
        position: {
          // grep --line-
          line: 2,
          character: 12,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toEqual(
      expect.arrayContaining([
        {
          data: {
            name: expect.stringMatching(RegExp('--line-.*')),
            type: CompletionItemDataType.Symbol,
          },
          kind: expect.any(Number),
          label: expect.stringMatching(RegExp('--line-.*')),
        },
      ]),
    )
  })

  it('responds to onCompletion with entire list when no word is found', async () => {
    const { connection } = await initializeServer()

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          // empty space
          line: 26,
          character: 0,
        },
      },
      {} as any,
      {} as any,
    )

    // Entire list
    expect(result && 'length' in result && result.length).toBeGreaterThanOrEqual(50)
  })

  it('responds to onCompletion with empty list when word is a comment', async () => {
    const { connection } = await initializeServer()

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          // inside comment
          line: 2,
          character: 1,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toEqual([])
  })

  it('responds to onCompletion with empty list when word is {', async () => {
    const { connection } = await initializeServer()

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.ISSUE101,
        },
        position: {
          // the opening brace '{' to 'add_a_user'
          line: 4,
          character: 0,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toEqual([])
  })

  it('responds to onCompletion when word is found in another file', async () => {
    const { connection } = await initializeServer()

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const resultVariable = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
        position: {
          // $BLU (variable)
          line: 6,
          character: 7,
        },
      },
      {} as any,
      {} as any,
    )

    expect(resultVariable).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "name": "BLUE",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Variable: **BLUE** - *defined in extension.inc*",
          },
          "kind": 6,
          "label": "BLUE",
        },
      ]
    `)

    const resultFunction = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
        position: {
          // add_a_us (function)
          line: 8,
          character: 7,
        },
      },
      {} as any,
      {} as any,
    )

    expect(resultFunction).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "name": "add_a_user",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Function: **add_a_user** - *defined in issue101.sh*

      \`\`\`txt
      Helper function to add a user
      \`\`\`",
          },
          "kind": 3,
          "label": "add_a_user",
        },
      ]
    `)
  })

  it('responds to onCompletion with local symbol when word is found in multiple files', async () => {
    const { connection } = await initializeServer()

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
        position: {
          // BOL (BOLD is defined in multiple places)
          line: 12,
          character: 7,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "name": "BOLD",
            "type": 3,
          },
          "documentation": undefined,
          "kind": 6,
          "label": "BOLD",
        },
      ]
    `)
  })

  it('responds to onCompletion with all variables when starting to expand parameters', async () => {
    const { connection } = await initializeServer({ rootPath: REPO_ROOT_FOLDER })

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result: any = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
        position: {
          // $
          line: 14,
          character: 7,
        },
      },
      {} as any,
      {} as any,
    )

    // they are all variables
    expect(Array.from(new Set(result.map((item: any) => item.kind)))).toEqual([
      LSP.CompletionItemKind.Variable,
    ])
    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "name": "BOLD",
            "type": 3,
          },
          "documentation": undefined,
          "kind": 6,
          "label": "BOLD",
        },
        Object {
          "data": Object {
            "name": "RED",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Variable: **RED** - *defined in extension.inc*",
          },
          "kind": 6,
          "label": "RED",
        },
        Object {
          "data": Object {
            "name": "GREEN",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Variable: **GREEN** - *defined in extension.inc*",
          },
          "kind": 6,
          "label": "GREEN",
        },
        Object {
          "data": Object {
            "name": "BLUE",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Variable: **BLUE** - *defined in extension.inc*",
          },
          "kind": 6,
          "label": "BLUE",
        },
        Object {
          "data": Object {
            "name": "RESET",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Variable: **RESET** - *defined in extension.inc*",
          },
          "kind": 6,
          "label": "RESET",
        },
        Object {
          "data": Object {
            "name": "USER",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Variable: **USER** - *defined in issue101.sh*",
          },
          "kind": 6,
          "label": "USER",
        },
        Object {
          "data": Object {
            "name": "PASSWORD",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Variable: **PASSWORD** - *defined in issue101.sh*",
          },
          "kind": 6,
          "label": "PASSWORD",
        },
        Object {
          "data": Object {
            "name": "COMMENTS",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Variable: **COMMENTS** - *defined in issue101.sh*

      \`\`\`txt
      Having shifted twice, the rest is now comments ...
      \`\`\`",
          },
          "kind": 6,
          "label": "COMMENTS",
        },
        Object {
          "data": Object {
            "name": "tag",
            "type": 3,
          },
          "documentation": Object {
            "kind": "markdown",
            "value": "Variable: **tag** - *defined in ../../scripts/tag-release.inc*",
          },
          "kind": 6,
          "label": "tag",
        },
      ]
    `)
  })

  it('responds to onCodeAction', async () => {
    const { connection, server } = await initializeServer()
    const document = FIXTURE_DOCUMENT.COMMENT_DOC

    await server.analyzeAndLintDocument(document)

    expect(connection.sendDiagnostics).toHaveBeenCalledTimes(1)
    const { diagnostics } = connection.sendDiagnostics.mock.calls[0][0]
    const fixableDiagnostic = diagnostics.filter(({ code }) => code === 'SC2086')[0]

    expect(fixableDiagnostic).toMatchInlineSnapshot(`
      Object {
        "code": "SC2086",
        "codeDescription": Object {
          "href": "https://www.shellcheck.net/wiki/SC2086",
        },
        "message": "Double quote to prevent globbing and word splitting.",
        "range": Object {
          "end": Object {
            "character": 13,
            "line": 55,
          },
          "start": Object {
            "character": 5,
            "line": 55,
          },
        },
        "severity": 3,
        "source": "shellcheck",
        "tags": undefined,
      }
    `)

    // TODO: we could find the diagnostics and then use the range to test the code action

    const onCodeAction = connection.onCodeAction.mock.calls[0][0]

    const result = await onCodeAction(
      {
        textDocument: {
          uri: FIXTURE_URI.COMMENT_DOC,
        },
        range: fixableDiagnostic.range,
        context: {
          diagnostics: [fixableDiagnostic],
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toHaveLength(1)
    const codeAction = (result as CodeAction[])[0]
    expect(codeAction.diagnostics).toEqual([fixableDiagnostic])
    expect(codeAction.diagnostics).toEqual([fixableDiagnostic])

    expect(codeAction.edit?.changes && codeAction.edit?.changes[FIXTURE_URI.COMMENT_DOC])
      .toMatchInlineSnapshot(`
      Array [
        Object {
          "newText": "\\"",
          "range": Object {
            "end": Object {
              "character": 13,
              "line": 55,
            },
            "start": Object {
              "character": 13,
              "line": 55,
            },
          },
        },
        Object {
          "newText": "\\"",
          "range": Object {
            "end": Object {
              "character": 5,
              "line": 55,
            },
            "start": Object {
              "character": 5,
              "line": 55,
            },
          },
        },
      ]
    `)
  })
})
