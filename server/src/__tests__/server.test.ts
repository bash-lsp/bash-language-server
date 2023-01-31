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
  updateSnapshotUris,
} from '../../../testing/fixtures'
import { getMockConnection } from '../../../testing/mocks'
import LspServer from '../server'
import { CompletionItemDataType } from '../types'
import { Logger } from '../util/logger'

// Skip ShellCheck throttle delay in test cases
jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
  fn()
  return 0 as any
})

jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {
  // noop
})

async function initializeServer({
  capabilities,
  configurationObject,
  rootPath,
}: {
  capabilities?: LSP.ClientCapabilities
  configurationObject?: unknown
  rootPath?: string
} = {}) {
  const diagnostics: Array<LSP.PublishDiagnosticsParams | undefined> = []

  const connection = getMockConnection()

  const server = await LspServer.initialize(connection, {
    rootPath: rootPath || pathToFileURL(FIXTURE_FOLDER).href,
    rootUri: null,
    processId: 42,
    capabilities: capabilities || {},
    workspaceFolders: null,
  })

  if (configurationObject) {
    const getConfiguration = connection.workspace.getConfiguration as any
    getConfiguration.mockResolvedValue(configurationObject)
  }

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
    expect(server.capabilities()).toMatchInlineSnapshot(`
      {
        "codeActionProvider": {
          "codeActionKinds": [
            "quickfix",
          ],
          "resolveProvider": false,
          "workDoneProgress": false,
        },
        "completionProvider": {
          "resolveProvider": true,
          "triggerCharacters": [
            "$",
            "{",
          ],
        },
        "definitionProvider": true,
        "documentHighlightProvider": true,
        "documentSymbolProvider": true,
        "hoverProvider": true,
        "referencesProvider": true,
        "textDocumentSync": 1,
        "workspaceSymbolProvider": true,
      }
    `)
  })

  it('register LSP connection', async () => {
    const { connection } = await initializeServer()

    expect(connection.onCodeAction).toHaveBeenCalledTimes(1)
    expect(connection.onCompletion).toHaveBeenCalledTimes(1)
    expect(connection.onCompletionResolve).toHaveBeenCalledTimes(1)
    expect(connection.onDefinition).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentHighlight).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onHover).toHaveBeenCalledTimes(1)
    expect(connection.onReferences).toHaveBeenCalledTimes(1)
    expect(connection.onWorkspaceSymbol).toHaveBeenCalledTimes(1)
  })

  it('allows for defining workspace configuration', async () => {
    const { connection } = await initializeServer({
      capabilities: {
        workspace: {
          configuration: true,
        },
      },
      configurationObject: {
        explainshellEndpoint: 'foo',
      },
    })

    expect(connection.workspace.getConfiguration).toHaveBeenCalled()
    expect(Logger.prototype.log).not.toHaveBeenCalledWith(expect.any(Number), [
      expect.stringContaining('updateConfiguration: failed'),
    ])
  })

  it('ignores invalid workspace configuration', async () => {
    const { connection } = await initializeServer({
      capabilities: {
        workspace: {
          configuration: true,
        },
      },
      configurationObject: {
        explainshellEndpoint: 42,
      },
    })

    expect(connection.workspace.getConfiguration).toHaveBeenCalled()
    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.any(Number), [
      expect.stringContaining('updateConfiguration: failed'),
    ])
  })

  it('responds to onDidChangeConfiguration', async () => {
    const { connection } = await initializeServer({
      capabilities: {
        workspace: {
          configuration: true,
        },
      },
    })

    const onDidChangeConfiguration = connection.onDidChangeConfiguration.mock.calls[0][0]

    onDidChangeConfiguration({ settings: { bashIde: { explainshellEndpoint: 42 } } })

    expect(connection.workspace.getConfiguration).toHaveBeenCalled()
    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.any(Number), [
      expect.stringContaining('updateConfiguration: failed'),
    ])
  })

  describe('onCodeAction', () => {
    it('responds to onCodeAction', async () => {
      const { connection, server } = await initializeServer()
      const document = FIXTURE_DOCUMENT.COMMENT_DOC

      await server.analyzeAndLintDocument(document)

      expect(connection.sendDiagnostics).toHaveBeenCalledTimes(1)
      const { diagnostics } = connection.sendDiagnostics.mock.calls[0][0]
      const fixableDiagnostic = diagnostics.filter(({ code }) => code === 'SC2086')[0]

      expect(fixableDiagnostic).toMatchInlineSnapshot(`
        {
          "code": "SC2086",
          "codeDescription": {
            "href": "https://www.shellcheck.net/wiki/SC2086",
          },
          "data": {
            "id": "shellcheck|2086|55:5-55:13",
          },
          "message": "Double quote to prevent globbing and word splitting.",
          "range": {
            "end": {
              "character": 13,
              "line": 55,
            },
            "start": {
              "character": 5,
              "line": 55,
            },
          },
          "severity": 3,
          "source": "shellcheck",
          "tags": undefined,
        }
      `)

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

      expect(
        codeAction.edit?.changes && codeAction.edit?.changes[FIXTURE_URI.COMMENT_DOC],
      ).toMatchInlineSnapshot(`
        [
          {
            "newText": """,
            "range": {
              "end": {
                "character": 13,
                "line": 55,
              },
              "start": {
                "character": 13,
                "line": 55,
              },
            },
          },
          {
            "newText": """,
            "range": {
              "end": {
                "character": 5,
                "line": 55,
              },
              "start": {
                "character": 5,
                "line": 55,
              },
            },
          },
        ]
      `)
    })
  })

  describe('onCompletion', () => {
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
        // eslint-disable-next-line no-console
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

    it('responds to onCompletion with empty list when the following characters is not an empty string or whitespace', async () => {
      const { connection } = await initializeServer()

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const result = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.INSTALL,
          },
          position: {
            // {
            line: 271,
            character: 21,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result).toEqual([])
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
        [
          {
            "data": {
              "type": 3,
            },
            "documentation": {
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
        [
          {
            "data": {
              "type": 3,
            },
            "documentation": {
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
        [
          {
            "data": {
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

      const result = await onCompletion(
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
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "type": 3,
            },
            "documentation": undefined,
            "kind": 6,
            "label": "BOLD",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **RED** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "RED",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **GREEN** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "GREEN",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **BLUE** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "BLUE",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **RESET** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "RESET",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **FILE_PATH** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "FILE_PATH",
          },
        ]
      `)
    })
  })

  describe('onCompletionResolve', () => {
    it('resolves documentation for buitins', async () => {
      const { connection } = await initializeServer({ rootPath: REPO_ROOT_FOLDER })

      const onCompletionResolve = connection.onCompletionResolve.mock.calls[0][0]

      const item = {
        data: {
          type: CompletionItemDataType.Builtin,
        },
        kind: LSP.CompletionItemKind.Function,
        label: 'echo',
      }
      const result = await onCompletionResolve(item, {} as any)

      expect(result).toEqual({
        ...item,
        documentation: {
          kind: 'markdown',
          value: expect.stringContaining('Write arguments to the standard output'),
        },
      })
    })

    it('ignores unknown items', async () => {
      const { connection } = await initializeServer({ rootPath: REPO_ROOT_FOLDER })

      const onCompletionResolve = connection.onCompletionResolve.mock.calls[0][0]

      const item = {
        data: {
          type: CompletionItemDataType.Symbol,
        },
        kind: LSP.CompletionItemKind.Function,
        label: 'foobar',
      }
      const result = await onCompletionResolve(item, {} as any)

      expect(result).toEqual({
        ...item,
        documentation: undefined,
      })
    })
  })

  describe('onDefinition', () => {
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

      expect(updateSnapshotUris(result)).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 0,
                "line": 0,
              },
              "start": {
                "character": 0,
                "line": 0,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
        ]
      `)
    })
  })

  describe('onDocumentHighlight', () => {
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

      expect(result1).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 12,
                "line": 0,
              },
              "start": {
                "character": 9,
                "line": 0,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 28,
                "line": 1,
              },
              "start": {
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
            // readonly is a declaration command so not parsed correctly by findOccurrences
            line: 0,
            character: 0,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result2).toMatchInlineSnapshot(`[]`)

      const result3 = await onDocumentHighlight(
        {
          textDocument: {
            uri: FIXTURE_URI.SCOPE,
          },
          position: {
            // X
            line: 32,
            character: 8,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result3).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 1,
                "line": 2,
              },
              "start": {
                "character": 0,
                "line": 2,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 1,
                "line": 4,
              },
              "start": {
                "character": 0,
                "line": 4,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 9,
                "line": 8,
              },
              "start": {
                "character": 8,
                "line": 8,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 11,
                "line": 12,
              },
              "start": {
                "character": 10,
                "line": 12,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 13,
                "line": 15,
              },
              "start": {
                "character": 12,
                "line": 15,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 13,
                "line": 19,
              },
              "start": {
                "character": 12,
                "line": 19,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 15,
                "line": 20,
              },
              "start": {
                "character": 14,
                "line": 20,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 11,
                "line": 29,
              },
              "start": {
                "character": 10,
                "line": 29,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 9,
                "line": 32,
              },
              "start": {
                "character": 8,
                "line": 32,
              },
            },
          },
        ]
      `)
    })
  })

  describe('onDocumentSymbol', () => {
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

      expect(updateSnapshotUris(result)).toMatchInlineSnapshot(`
        [
          {
            "kind": 13,
            "location": {
              "range": {
                "end": {
                  "character": 16,
                  "line": 10,
                },
                "start": {
                  "character": 0,
                  "line": 10,
                },
              },
              "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/sourcing.sh",
            },
            "name": "BOLD",
          },
          {
            "kind": 12,
            "location": {
              "range": {
                "end": {
                  "character": 1,
                  "line": 22,
                },
                "start": {
                  "character": 0,
                  "line": 20,
                },
              },
              "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/sourcing.sh",
            },
            "name": "loadlib",
          },
        ]
      `)
    })
  })

  describe('onHover', () => {
    async function getHoverResult(uri: string, position: LSP.Position) {
      const { connection } = await initializeServer()

      const onHover = connection.onHover.mock.calls[0][0]

      return onHover(
        {
          textDocument: {
            uri,
          },
          position,
        },
        {} as any,
        {} as any,
      )
    }
    it('responds with documentation for command', async () => {
      const result = await getHoverResult(FIXTURE_URI.INSTALL, {
        // rm
        line: 25,
        character: 5,
      })

      expect(result).toEqual({
        contents: {
          kind: 'markdown',
          value: expect.stringContaining('remove directories'),
        },
      })
    })

    it('responds with function documentation extracted from comments', async () => {
      const result = await getHoverResult(FIXTURE_URI.COMMENT_DOC, {
        line: 17,
        character: 0,
      })

      expect(result).toMatchInlineSnapshot(`
        {
          "contents": {
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

    it('displays correct documentation for symbols in file that override path executables', async () => {
      const result = await getHoverResult(FIXTURE_URI.OVERRIDE_SYMBOL, {
        line: 9,
        character: 1,
      })

      expect(result).toMatchInlineSnapshot(`
        {
          "contents": {
            "kind": "markdown",
            "value": "Function: **ls** - *defined on line 6*

        \`\`\`txt
        override documentation for \`ls\` symbol
        \`\`\`",
          },
        }
      `)
    })

    it('returns executable documentation if the function is not redefined', async () => {
      const result1 = await getHoverResult(FIXTURE_URI.OVERRIDE_SYMBOL, {
        line: 2,
        character: 1,
      })
      expect(result1).toEqual({
        contents: {
          kind: 'markdown',
          value: expect.stringContaining('list directory contents'),
        },
      })

      // return null same result if the cursor is on the arguments
      const result2 = await getHoverResult(FIXTURE_URI.OVERRIDE_SYMBOL, {
        line: 2,
        character: 3,
      })
      expect(result2).toEqual(null)
    })

    it('responds with documentation even if parsing fails', async () => {
      const result = await getHoverResult(FIXTURE_URI.MISSING_NODE2, {
        // sleep
        line: 12,
        character: 4,
      })

      expect(result).toEqual({
        contents: {
          kind: 'markdown',
          value: expect.stringContaining('sleep'),
        },
      })
    })

    it.skip('returns documentation from explainshell', async () => {
      // Skipped as this requires a running explainshell server (and the code is hard to mock)
      // docker container run --name explainshell --restart always -p 127.0.0.1:6000:5000 -d spaceinvaderone/explainshell

      const { connection } = await initializeServer({
        capabilities: {
          workspace: {
            configuration: true,
          },
        },
        configurationObject: {
          explainshellEndpoint: 'http://localhost:6000',
        },
      })
      const onHover = connection.onHover.mock.calls[0][0]

      const getHoverResult = (position: LSP.Position) =>
        onHover(
          {
            textDocument: {
              uri: FIXTURE_URI.OVERRIDE_SYMBOL,
            },
            position,
          },
          {} as any,
          {} as any,
        )

      const result1 = await getHoverResult({ line: 2, character: 1 })
      expect(result1).toBeDefined()
      expect((result1 as any)?.contents.value).toEqual('list directory contents')

      // return explain shell result for the arguments
      const result2 = await getHoverResult({ line: 2, character: 3 })
      expect(result2).toBeDefined()
      expect((result2 as any)?.contents.value).toEqual(
        '**\\-l** use a long listing format',
      )
    })
  })

  describe('onReferences', () => {
    async function getOnReferencesTestCase() {
      const { connection } = await initializeServer()
      const onReferences = connection.onReferences.mock.calls[0][0]

      const callOnReferences = ({
        includeDeclarationOfCurrentSymbol,
        uri,
        position,
      }: {
        includeDeclarationOfCurrentSymbol: boolean
        uri: string
        position: LSP.Position
      }) =>
        updateSnapshotUris(
          onReferences(
            {
              textDocument: {
                uri,
              },
              position,
              context: {
                includeDeclaration: includeDeclarationOfCurrentSymbol,
              },
            },
            {} as any,
            {} as any,
          ),
        )

      return {
        callOnReferences,
      }
    }

    it('returns null if the word is not found', async () => {
      const { callOnReferences } = await getOnReferencesTestCase()
      const result = await callOnReferences({
        position: { line: 34, character: 1 }, // empty line
        uri: FIXTURE_URI.INSTALL,
        includeDeclarationOfCurrentSymbol: true,
      })
      expect(result).toBeNull()
    })

    it('returns references to builtins and executables across the workspace', async () => {
      const { callOnReferences } = await getOnReferencesTestCase()
      const result = await callOnReferences({
        position: { line: 263, character: 5 }, // echo
        uri: FIXTURE_URI.INSTALL,
        includeDeclarationOfCurrentSymbol: true,
      })
      expect(Array.isArray(result)).toBe(true)
      if (Array.isArray(result)) {
        expect(result.length).toBeGreaterThan(50)
        expect(new Set(result.map((v) => v.uri)).size).toBeGreaterThan(5)
      }
    })

    it('returns references depending on the context flag', async () => {
      const { callOnReferences } = await getOnReferencesTestCase()

      const resultIncludingCurrentSymbol = await callOnReferences({
        position: { line: 50, character: 10 }, // npm_config_loglevel
        uri: FIXTURE_URI.INSTALL,
        includeDeclarationOfCurrentSymbol: true,
      })

      const resultExcludingCurrentSymbol = await callOnReferences({
        position: { line: 50, character: 10 }, // npm_config_loglevel
        uri: FIXTURE_URI.INSTALL,
        includeDeclarationOfCurrentSymbol: false,
      })

      expect(resultIncludingCurrentSymbol).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 19,
                "line": 40,
              },
              "start": {
                "character": 0,
                "line": 40,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 21,
                "line": 48,
              },
              "start": {
                "character": 2,
                "line": 48,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 26,
                "line": 50,
              },
              "start": {
                "character": 7,
                "line": 50,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 26,
                "line": 42,
              },
              "start": {
                "character": 7,
                "line": 42,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
        ]
      `)

      expect(resultExcludingCurrentSymbol).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 19,
                "line": 40,
              },
              "start": {
                "character": 0,
                "line": 40,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 21,
                "line": 48,
              },
              "start": {
                "character": 2,
                "line": 48,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 26,
                "line": 42,
              },
              "start": {
                "character": 7,
                "line": 42,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
        ]
      `)
    })
  })

  describe('onWorkspaceSymbol', () => {
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
        ])
      }

      await lookupAndExpectNpmConfigLoglevelResult('npm_config_loglevel') // exact
      await lookupAndExpectNpmConfigLoglevelResult('config_log') // in the middle
      await lookupAndExpectNpmConfigLoglevelResult('npmloglevel') // fuzzy
    })
  })
})
