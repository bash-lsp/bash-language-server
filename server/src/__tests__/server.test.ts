import * as Process from 'child_process'
import * as Path from 'path'
import * as lsp from 'vscode-languageserver'

import { FIXTURE_FOLDER, FIXTURE_URI } from '../../../testing/fixtures'
import { getMockConnection } from '../../../testing/mocks'
import LspServer from '../server'
import { CompletionItemDataType } from '../types'

async function initializeServer() {
  const diagnostics: Array<lsp.PublishDiagnosticsParams | undefined> = []

  const connection = getMockConnection()

  const server = await LspServer.initialize(connection, {
    rootPath: FIXTURE_FOLDER,
    rootUri: null,
    processId: 42,
    capabilities: {} as any,
    workspaceFolders: null,
  })

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
    const { connection, server } = await initializeServer()

    server.register(connection)

    expect(connection.onHover).toHaveBeenCalledTimes(1)
    expect(connection.onDefinition).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onWorkspaceSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentHighlight).toHaveBeenCalledTimes(1)
    expect(connection.onReferences).toHaveBeenCalledTimes(1)
    expect(connection.onCompletion).toHaveBeenCalledTimes(1)
    expect(connection.onCompletionResolve).toHaveBeenCalledTimes(1)
  })

  it('responds to onHover', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

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
    const { connection, server } = await initializeServer()
    server.register(connection)

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
    expect(result).toEqual({
      contents:
        '```txt\nFunction: **hello_world** *defined on line 8*\n\nthis is a comment\ndescribing the function\nhello_world\nthis function takes two arguments\n```',
    })
  })

  it('responds to onDocumentHighlight', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

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
    expect(result1).toMatchInlineSnapshot(`Array []`)

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
    const { connection, server } = await initializeServer()
    server.register(connection)

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
    const { connection, server } = await initializeServer()
    server.register(connection)

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

    const { connection, server } = await initializeServer()
    server.register(connection)

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
    const { connection, server } = await initializeServer()
    server.register(connection)

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
    const { connection, server } = await initializeServer()
    server.register(connection)

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
    const { connection, server } = await initializeServer()
    server.register(connection)

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
    const { connection, server } = await initializeServer()
    server.register(connection)

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
            "name": "!",
            "type": 2,
          },
          "kind": 11,
          "label": "!",
        },
        Object {
          "data": Object {
            "name": "[[",
            "type": 2,
          },
          "kind": 11,
          "label": "[[",
        },
        Object {
          "data": Object {
            "name": "]]",
            "type": 2,
          },
          "kind": 11,
          "label": "]]",
        },
        Object {
          "data": Object {
            "name": "{",
            "type": 2,
          },
          "kind": 11,
          "label": "{",
        },
        Object {
          "data": Object {
            "name": "}",
            "type": 2,
          },
          "kind": 11,
          "label": "}",
        },
        Object {
          "data": Object {
            "name": "case",
            "type": 2,
          },
          "kind": 11,
          "label": "case",
        },
        Object {
          "data": Object {
            "name": "do",
            "type": 2,
          },
          "kind": 11,
          "label": "do",
        },
        Object {
          "data": Object {
            "name": "done",
            "type": 2,
          },
          "kind": 11,
          "label": "done",
        },
        Object {
          "data": Object {
            "name": "elif",
            "type": 2,
          },
          "kind": 11,
          "label": "elif",
        },
        Object {
          "data": Object {
            "name": "else",
            "type": 2,
          },
          "kind": 11,
          "label": "else",
        },
        Object {
          "data": Object {
            "name": "esac",
            "type": 2,
          },
          "kind": 11,
          "label": "esac",
        },
        Object {
          "data": Object {
            "name": "fi",
            "type": 2,
          },
          "kind": 11,
          "label": "fi",
        },
        Object {
          "data": Object {
            "name": "for",
            "type": 2,
          },
          "kind": 11,
          "label": "for",
        },
        Object {
          "data": Object {
            "name": "function",
            "type": 2,
          },
          "kind": 11,
          "label": "function",
        },
        Object {
          "data": Object {
            "name": "if",
            "type": 2,
          },
          "kind": 11,
          "label": "if",
        },
        Object {
          "data": Object {
            "name": "in",
            "type": 2,
          },
          "kind": 11,
          "label": "in",
        },
        Object {
          "data": Object {
            "name": "select",
            "type": 2,
          },
          "kind": 11,
          "label": "select",
        },
        Object {
          "data": Object {
            "name": "then",
            "type": 2,
          },
          "kind": 11,
          "label": "then",
        },
        Object {
          "data": Object {
            "name": "time",
            "type": 2,
          },
          "kind": 11,
          "label": "time",
        },
        Object {
          "data": Object {
            "name": "until",
            "type": 2,
          },
          "kind": 11,
          "label": "until",
        },
        Object {
          "data": Object {
            "name": "while",
            "type": 2,
          },
          "kind": 11,
          "label": "while",
        },
        Object {
          "data": Object {
            "name": ".",
            "type": 0,
          },
          "kind": 11,
          "label": ".",
        },
        Object {
          "data": Object {
            "name": ":",
            "type": 0,
          },
          "kind": 11,
          "label": ":",
        },
        Object {
          "data": Object {
            "name": "[",
            "type": 0,
          },
          "kind": 11,
          "label": "[",
        },
        Object {
          "data": Object {
            "name": "alias",
            "type": 0,
          },
          "kind": 11,
          "label": "alias",
        },
        Object {
          "data": Object {
            "name": "bg",
            "type": 0,
          },
          "kind": 11,
          "label": "bg",
        },
        Object {
          "data": Object {
            "name": "bind",
            "type": 0,
          },
          "kind": 11,
          "label": "bind",
        },
        Object {
          "data": Object {
            "name": "break",
            "type": 0,
          },
          "kind": 11,
          "label": "break",
        },
        Object {
          "data": Object {
            "name": "builtin",
            "type": 0,
          },
          "kind": 11,
          "label": "builtin",
        },
        Object {
          "data": Object {
            "name": "caller",
            "type": 0,
          },
          "kind": 11,
          "label": "caller",
        },
        Object {
          "data": Object {
            "name": "cd",
            "type": 0,
          },
          "kind": 11,
          "label": "cd",
        },
        Object {
          "data": Object {
            "name": "command",
            "type": 0,
          },
          "kind": 11,
          "label": "command",
        },
        Object {
          "data": Object {
            "name": "compgen",
            "type": 0,
          },
          "kind": 11,
          "label": "compgen",
        },
        Object {
          "data": Object {
            "name": "compopt",
            "type": 0,
          },
          "kind": 11,
          "label": "compopt",
        },
        Object {
          "data": Object {
            "name": "complete",
            "type": 0,
          },
          "kind": 11,
          "label": "complete",
        },
        Object {
          "data": Object {
            "name": "continue",
            "type": 0,
          },
          "kind": 11,
          "label": "continue",
        },
        Object {
          "data": Object {
            "name": "declare",
            "type": 0,
          },
          "kind": 11,
          "label": "declare",
        },
        Object {
          "data": Object {
            "name": "dirs",
            "type": 0,
          },
          "kind": 11,
          "label": "dirs",
        },
        Object {
          "data": Object {
            "name": "disown",
            "type": 0,
          },
          "kind": 11,
          "label": "disown",
        },
        Object {
          "data": Object {
            "name": "echo",
            "type": 0,
          },
          "kind": 11,
          "label": "echo",
        },
        Object {
          "data": Object {
            "name": "enable",
            "type": 0,
          },
          "kind": 11,
          "label": "enable",
        },
        Object {
          "data": Object {
            "name": "eval",
            "type": 0,
          },
          "kind": 11,
          "label": "eval",
        },
        Object {
          "data": Object {
            "name": "exec",
            "type": 0,
          },
          "kind": 11,
          "label": "exec",
        },
        Object {
          "data": Object {
            "name": "exit",
            "type": 0,
          },
          "kind": 11,
          "label": "exit",
        },
        Object {
          "data": Object {
            "name": "export",
            "type": 0,
          },
          "kind": 11,
          "label": "export",
        },
        Object {
          "data": Object {
            "name": "false",
            "type": 0,
          },
          "kind": 11,
          "label": "false",
        },
        Object {
          "data": Object {
            "name": "fc",
            "type": 0,
          },
          "kind": 11,
          "label": "fc",
        },
        Object {
          "data": Object {
            "name": "fg",
            "type": 0,
          },
          "kind": 11,
          "label": "fg",
        },
        Object {
          "data": Object {
            "name": "getopts",
            "type": 0,
          },
          "kind": 11,
          "label": "getopts",
        },
        Object {
          "data": Object {
            "name": "hash",
            "type": 0,
          },
          "kind": 11,
          "label": "hash",
        },
        Object {
          "data": Object {
            "name": "help",
            "type": 0,
          },
          "kind": 11,
          "label": "help",
        },
        Object {
          "data": Object {
            "name": "history",
            "type": 0,
          },
          "kind": 11,
          "label": "history",
        },
        Object {
          "data": Object {
            "name": "jobs",
            "type": 0,
          },
          "kind": 11,
          "label": "jobs",
        },
        Object {
          "data": Object {
            "name": "kill",
            "type": 0,
          },
          "kind": 11,
          "label": "kill",
        },
        Object {
          "data": Object {
            "name": "let",
            "type": 0,
          },
          "kind": 11,
          "label": "let",
        },
        Object {
          "data": Object {
            "name": "local",
            "type": 0,
          },
          "kind": 11,
          "label": "local",
        },
        Object {
          "data": Object {
            "name": "logout",
            "type": 0,
          },
          "kind": 11,
          "label": "logout",
        },
        Object {
          "data": Object {
            "name": "popd",
            "type": 0,
          },
          "kind": 11,
          "label": "popd",
        },
        Object {
          "data": Object {
            "name": "printf",
            "type": 0,
          },
          "kind": 11,
          "label": "printf",
        },
        Object {
          "data": Object {
            "name": "pushd",
            "type": 0,
          },
          "kind": 11,
          "label": "pushd",
        },
        Object {
          "data": Object {
            "name": "pwd",
            "type": 0,
          },
          "kind": 11,
          "label": "pwd",
        },
        Object {
          "data": Object {
            "name": "read",
            "type": 0,
          },
          "kind": 11,
          "label": "read",
        },
        Object {
          "data": Object {
            "name": "readonly",
            "type": 0,
          },
          "kind": 11,
          "label": "readonly",
        },
        Object {
          "data": Object {
            "name": "return",
            "type": 0,
          },
          "kind": 11,
          "label": "return",
        },
        Object {
          "data": Object {
            "name": "set",
            "type": 0,
          },
          "kind": 11,
          "label": "set",
        },
        Object {
          "data": Object {
            "name": "shift",
            "type": 0,
          },
          "kind": 11,
          "label": "shift",
        },
        Object {
          "data": Object {
            "name": "shopt",
            "type": 0,
          },
          "kind": 11,
          "label": "shopt",
        },
        Object {
          "data": Object {
            "name": "source",
            "type": 0,
          },
          "kind": 11,
          "label": "source",
        },
        Object {
          "data": Object {
            "name": "suspend",
            "type": 0,
          },
          "kind": 11,
          "label": "suspend",
        },
        Object {
          "data": Object {
            "name": "test",
            "type": 0,
          },
          "kind": 11,
          "label": "test",
        },
        Object {
          "data": Object {
            "name": "times",
            "type": 0,
          },
          "kind": 11,
          "label": "times",
        },
        Object {
          "data": Object {
            "name": "trap",
            "type": 0,
          },
          "kind": 11,
          "label": "trap",
        },
        Object {
          "data": Object {
            "name": "true",
            "type": 0,
          },
          "kind": 11,
          "label": "true",
        },
        Object {
          "data": Object {
            "name": "type",
            "type": 0,
          },
          "kind": 11,
          "label": "type",
        },
        Object {
          "data": Object {
            "name": "typeset",
            "type": 0,
          },
          "kind": 11,
          "label": "typeset",
        },
        Object {
          "data": Object {
            "name": "ulimit",
            "type": 0,
          },
          "kind": 11,
          "label": "ulimit",
        },
        Object {
          "data": Object {
            "name": "umask",
            "type": 0,
          },
          "kind": 11,
          "label": "umask",
        },
        Object {
          "data": Object {
            "name": "unalias",
            "type": 0,
          },
          "kind": 11,
          "label": "unalias",
        },
        Object {
          "data": Object {
            "name": "unset",
            "type": 0,
          },
          "kind": 11,
          "label": "unset",
        },
        Object {
          "data": Object {
            "name": "wait",
            "type": 0,
          },
          "kind": 11,
          "label": "wait",
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
            "name": "!",
            "type": 2,
          },
          "kind": 11,
          "label": "!",
        },
        Object {
          "data": Object {
            "name": "[[",
            "type": 2,
          },
          "kind": 11,
          "label": "[[",
        },
        Object {
          "data": Object {
            "name": "]]",
            "type": 2,
          },
          "kind": 11,
          "label": "]]",
        },
        Object {
          "data": Object {
            "name": "{",
            "type": 2,
          },
          "kind": 11,
          "label": "{",
        },
        Object {
          "data": Object {
            "name": "}",
            "type": 2,
          },
          "kind": 11,
          "label": "}",
        },
        Object {
          "data": Object {
            "name": "case",
            "type": 2,
          },
          "kind": 11,
          "label": "case",
        },
        Object {
          "data": Object {
            "name": "do",
            "type": 2,
          },
          "kind": 11,
          "label": "do",
        },
        Object {
          "data": Object {
            "name": "done",
            "type": 2,
          },
          "kind": 11,
          "label": "done",
        },
        Object {
          "data": Object {
            "name": "elif",
            "type": 2,
          },
          "kind": 11,
          "label": "elif",
        },
        Object {
          "data": Object {
            "name": "else",
            "type": 2,
          },
          "kind": 11,
          "label": "else",
        },
        Object {
          "data": Object {
            "name": "esac",
            "type": 2,
          },
          "kind": 11,
          "label": "esac",
        },
        Object {
          "data": Object {
            "name": "fi",
            "type": 2,
          },
          "kind": 11,
          "label": "fi",
        },
        Object {
          "data": Object {
            "name": "for",
            "type": 2,
          },
          "kind": 11,
          "label": "for",
        },
        Object {
          "data": Object {
            "name": "function",
            "type": 2,
          },
          "kind": 11,
          "label": "function",
        },
        Object {
          "data": Object {
            "name": "if",
            "type": 2,
          },
          "kind": 11,
          "label": "if",
        },
        Object {
          "data": Object {
            "name": "in",
            "type": 2,
          },
          "kind": 11,
          "label": "in",
        },
        Object {
          "data": Object {
            "name": "select",
            "type": 2,
          },
          "kind": 11,
          "label": "select",
        },
        Object {
          "data": Object {
            "name": "then",
            "type": 2,
          },
          "kind": 11,
          "label": "then",
        },
        Object {
          "data": Object {
            "name": "time",
            "type": 2,
          },
          "kind": 11,
          "label": "time",
        },
        Object {
          "data": Object {
            "name": "until",
            "type": 2,
          },
          "kind": 11,
          "label": "until",
        },
        Object {
          "data": Object {
            "name": "while",
            "type": 2,
          },
          "kind": 11,
          "label": "while",
        },
        Object {
          "data": Object {
            "name": ".",
            "type": 0,
          },
          "kind": 11,
          "label": ".",
        },
        Object {
          "data": Object {
            "name": ":",
            "type": 0,
          },
          "kind": 11,
          "label": ":",
        },
        Object {
          "data": Object {
            "name": "[",
            "type": 0,
          },
          "kind": 11,
          "label": "[",
        },
        Object {
          "data": Object {
            "name": "alias",
            "type": 0,
          },
          "kind": 11,
          "label": "alias",
        },
        Object {
          "data": Object {
            "name": "bg",
            "type": 0,
          },
          "kind": 11,
          "label": "bg",
        },
        Object {
          "data": Object {
            "name": "bind",
            "type": 0,
          },
          "kind": 11,
          "label": "bind",
        },
        Object {
          "data": Object {
            "name": "break",
            "type": 0,
          },
          "kind": 11,
          "label": "break",
        },
        Object {
          "data": Object {
            "name": "builtin",
            "type": 0,
          },
          "kind": 11,
          "label": "builtin",
        },
        Object {
          "data": Object {
            "name": "caller",
            "type": 0,
          },
          "kind": 11,
          "label": "caller",
        },
        Object {
          "data": Object {
            "name": "cd",
            "type": 0,
          },
          "kind": 11,
          "label": "cd",
        },
        Object {
          "data": Object {
            "name": "command",
            "type": 0,
          },
          "kind": 11,
          "label": "command",
        },
        Object {
          "data": Object {
            "name": "compgen",
            "type": 0,
          },
          "kind": 11,
          "label": "compgen",
        },
        Object {
          "data": Object {
            "name": "compopt",
            "type": 0,
          },
          "kind": 11,
          "label": "compopt",
        },
        Object {
          "data": Object {
            "name": "complete",
            "type": 0,
          },
          "kind": 11,
          "label": "complete",
        },
        Object {
          "data": Object {
            "name": "continue",
            "type": 0,
          },
          "kind": 11,
          "label": "continue",
        },
        Object {
          "data": Object {
            "name": "declare",
            "type": 0,
          },
          "kind": 11,
          "label": "declare",
        },
        Object {
          "data": Object {
            "name": "dirs",
            "type": 0,
          },
          "kind": 11,
          "label": "dirs",
        },
        Object {
          "data": Object {
            "name": "disown",
            "type": 0,
          },
          "kind": 11,
          "label": "disown",
        },
        Object {
          "data": Object {
            "name": "echo",
            "type": 0,
          },
          "kind": 11,
          "label": "echo",
        },
        Object {
          "data": Object {
            "name": "enable",
            "type": 0,
          },
          "kind": 11,
          "label": "enable",
        },
        Object {
          "data": Object {
            "name": "eval",
            "type": 0,
          },
          "kind": 11,
          "label": "eval",
        },
        Object {
          "data": Object {
            "name": "exec",
            "type": 0,
          },
          "kind": 11,
          "label": "exec",
        },
        Object {
          "data": Object {
            "name": "exit",
            "type": 0,
          },
          "kind": 11,
          "label": "exit",
        },
        Object {
          "data": Object {
            "name": "export",
            "type": 0,
          },
          "kind": 11,
          "label": "export",
        },
        Object {
          "data": Object {
            "name": "false",
            "type": 0,
          },
          "kind": 11,
          "label": "false",
        },
        Object {
          "data": Object {
            "name": "fc",
            "type": 0,
          },
          "kind": 11,
          "label": "fc",
        },
        Object {
          "data": Object {
            "name": "fg",
            "type": 0,
          },
          "kind": 11,
          "label": "fg",
        },
        Object {
          "data": Object {
            "name": "getopts",
            "type": 0,
          },
          "kind": 11,
          "label": "getopts",
        },
        Object {
          "data": Object {
            "name": "hash",
            "type": 0,
          },
          "kind": 11,
          "label": "hash",
        },
        Object {
          "data": Object {
            "name": "help",
            "type": 0,
          },
          "kind": 11,
          "label": "help",
        },
        Object {
          "data": Object {
            "name": "history",
            "type": 0,
          },
          "kind": 11,
          "label": "history",
        },
        Object {
          "data": Object {
            "name": "jobs",
            "type": 0,
          },
          "kind": 11,
          "label": "jobs",
        },
        Object {
          "data": Object {
            "name": "kill",
            "type": 0,
          },
          "kind": 11,
          "label": "kill",
        },
        Object {
          "data": Object {
            "name": "let",
            "type": 0,
          },
          "kind": 11,
          "label": "let",
        },
        Object {
          "data": Object {
            "name": "local",
            "type": 0,
          },
          "kind": 11,
          "label": "local",
        },
        Object {
          "data": Object {
            "name": "logout",
            "type": 0,
          },
          "kind": 11,
          "label": "logout",
        },
        Object {
          "data": Object {
            "name": "popd",
            "type": 0,
          },
          "kind": 11,
          "label": "popd",
        },
        Object {
          "data": Object {
            "name": "printf",
            "type": 0,
          },
          "kind": 11,
          "label": "printf",
        },
        Object {
          "data": Object {
            "name": "pushd",
            "type": 0,
          },
          "kind": 11,
          "label": "pushd",
        },
        Object {
          "data": Object {
            "name": "pwd",
            "type": 0,
          },
          "kind": 11,
          "label": "pwd",
        },
        Object {
          "data": Object {
            "name": "read",
            "type": 0,
          },
          "kind": 11,
          "label": "read",
        },
        Object {
          "data": Object {
            "name": "readonly",
            "type": 0,
          },
          "kind": 11,
          "label": "readonly",
        },
        Object {
          "data": Object {
            "name": "return",
            "type": 0,
          },
          "kind": 11,
          "label": "return",
        },
        Object {
          "data": Object {
            "name": "set",
            "type": 0,
          },
          "kind": 11,
          "label": "set",
        },
        Object {
          "data": Object {
            "name": "shift",
            "type": 0,
          },
          "kind": 11,
          "label": "shift",
        },
        Object {
          "data": Object {
            "name": "shopt",
            "type": 0,
          },
          "kind": 11,
          "label": "shopt",
        },
        Object {
          "data": Object {
            "name": "source",
            "type": 0,
          },
          "kind": 11,
          "label": "source",
        },
        Object {
          "data": Object {
            "name": "suspend",
            "type": 0,
          },
          "kind": 11,
          "label": "suspend",
        },
        Object {
          "data": Object {
            "name": "test",
            "type": 0,
          },
          "kind": 11,
          "label": "test",
        },
        Object {
          "data": Object {
            "name": "times",
            "type": 0,
          },
          "kind": 11,
          "label": "times",
        },
        Object {
          "data": Object {
            "name": "trap",
            "type": 0,
          },
          "kind": 11,
          "label": "trap",
        },
        Object {
          "data": Object {
            "name": "true",
            "type": 0,
          },
          "kind": 11,
          "label": "true",
        },
        Object {
          "data": Object {
            "name": "type",
            "type": 0,
          },
          "kind": 11,
          "label": "type",
        },
        Object {
          "data": Object {
            "name": "typeset",
            "type": 0,
          },
          "kind": 11,
          "label": "typeset",
        },
        Object {
          "data": Object {
            "name": "ulimit",
            "type": 0,
          },
          "kind": 11,
          "label": "ulimit",
        },
        Object {
          "data": Object {
            "name": "umask",
            "type": 0,
          },
          "kind": 11,
          "label": "umask",
        },
        Object {
          "data": Object {
            "name": "unalias",
            "type": 0,
          },
          "kind": 11,
          "label": "unalias",
        },
        Object {
          "data": Object {
            "name": "unset",
            "type": 0,
          },
          "kind": 11,
          "label": "unset",
        },
        Object {
          "data": Object {
            "name": "wait",
            "type": 0,
          },
          "kind": 11,
          "label": "wait",
        },
      ]
    `)
  })

  it('responds to onCompletion with local symbol when word is found in multiple files', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

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
            "name": "!",
            "type": 2,
          },
          "kind": 11,
          "label": "!",
        },
        Object {
          "data": Object {
            "name": "[[",
            "type": 2,
          },
          "kind": 11,
          "label": "[[",
        },
        Object {
          "data": Object {
            "name": "]]",
            "type": 2,
          },
          "kind": 11,
          "label": "]]",
        },
        Object {
          "data": Object {
            "name": "{",
            "type": 2,
          },
          "kind": 11,
          "label": "{",
        },
        Object {
          "data": Object {
            "name": "}",
            "type": 2,
          },
          "kind": 11,
          "label": "}",
        },
        Object {
          "data": Object {
            "name": "case",
            "type": 2,
          },
          "kind": 11,
          "label": "case",
        },
        Object {
          "data": Object {
            "name": "do",
            "type": 2,
          },
          "kind": 11,
          "label": "do",
        },
        Object {
          "data": Object {
            "name": "done",
            "type": 2,
          },
          "kind": 11,
          "label": "done",
        },
        Object {
          "data": Object {
            "name": "elif",
            "type": 2,
          },
          "kind": 11,
          "label": "elif",
        },
        Object {
          "data": Object {
            "name": "else",
            "type": 2,
          },
          "kind": 11,
          "label": "else",
        },
        Object {
          "data": Object {
            "name": "esac",
            "type": 2,
          },
          "kind": 11,
          "label": "esac",
        },
        Object {
          "data": Object {
            "name": "fi",
            "type": 2,
          },
          "kind": 11,
          "label": "fi",
        },
        Object {
          "data": Object {
            "name": "for",
            "type": 2,
          },
          "kind": 11,
          "label": "for",
        },
        Object {
          "data": Object {
            "name": "function",
            "type": 2,
          },
          "kind": 11,
          "label": "function",
        },
        Object {
          "data": Object {
            "name": "if",
            "type": 2,
          },
          "kind": 11,
          "label": "if",
        },
        Object {
          "data": Object {
            "name": "in",
            "type": 2,
          },
          "kind": 11,
          "label": "in",
        },
        Object {
          "data": Object {
            "name": "select",
            "type": 2,
          },
          "kind": 11,
          "label": "select",
        },
        Object {
          "data": Object {
            "name": "then",
            "type": 2,
          },
          "kind": 11,
          "label": "then",
        },
        Object {
          "data": Object {
            "name": "time",
            "type": 2,
          },
          "kind": 11,
          "label": "time",
        },
        Object {
          "data": Object {
            "name": "until",
            "type": 2,
          },
          "kind": 11,
          "label": "until",
        },
        Object {
          "data": Object {
            "name": "while",
            "type": 2,
          },
          "kind": 11,
          "label": "while",
        },
        Object {
          "data": Object {
            "name": ".",
            "type": 0,
          },
          "kind": 11,
          "label": ".",
        },
        Object {
          "data": Object {
            "name": ":",
            "type": 0,
          },
          "kind": 11,
          "label": ":",
        },
        Object {
          "data": Object {
            "name": "[",
            "type": 0,
          },
          "kind": 11,
          "label": "[",
        },
        Object {
          "data": Object {
            "name": "alias",
            "type": 0,
          },
          "kind": 11,
          "label": "alias",
        },
        Object {
          "data": Object {
            "name": "bg",
            "type": 0,
          },
          "kind": 11,
          "label": "bg",
        },
        Object {
          "data": Object {
            "name": "bind",
            "type": 0,
          },
          "kind": 11,
          "label": "bind",
        },
        Object {
          "data": Object {
            "name": "break",
            "type": 0,
          },
          "kind": 11,
          "label": "break",
        },
        Object {
          "data": Object {
            "name": "builtin",
            "type": 0,
          },
          "kind": 11,
          "label": "builtin",
        },
        Object {
          "data": Object {
            "name": "caller",
            "type": 0,
          },
          "kind": 11,
          "label": "caller",
        },
        Object {
          "data": Object {
            "name": "cd",
            "type": 0,
          },
          "kind": 11,
          "label": "cd",
        },
        Object {
          "data": Object {
            "name": "command",
            "type": 0,
          },
          "kind": 11,
          "label": "command",
        },
        Object {
          "data": Object {
            "name": "compgen",
            "type": 0,
          },
          "kind": 11,
          "label": "compgen",
        },
        Object {
          "data": Object {
            "name": "compopt",
            "type": 0,
          },
          "kind": 11,
          "label": "compopt",
        },
        Object {
          "data": Object {
            "name": "complete",
            "type": 0,
          },
          "kind": 11,
          "label": "complete",
        },
        Object {
          "data": Object {
            "name": "continue",
            "type": 0,
          },
          "kind": 11,
          "label": "continue",
        },
        Object {
          "data": Object {
            "name": "declare",
            "type": 0,
          },
          "kind": 11,
          "label": "declare",
        },
        Object {
          "data": Object {
            "name": "dirs",
            "type": 0,
          },
          "kind": 11,
          "label": "dirs",
        },
        Object {
          "data": Object {
            "name": "disown",
            "type": 0,
          },
          "kind": 11,
          "label": "disown",
        },
        Object {
          "data": Object {
            "name": "echo",
            "type": 0,
          },
          "kind": 11,
          "label": "echo",
        },
        Object {
          "data": Object {
            "name": "enable",
            "type": 0,
          },
          "kind": 11,
          "label": "enable",
        },
        Object {
          "data": Object {
            "name": "eval",
            "type": 0,
          },
          "kind": 11,
          "label": "eval",
        },
        Object {
          "data": Object {
            "name": "exec",
            "type": 0,
          },
          "kind": 11,
          "label": "exec",
        },
        Object {
          "data": Object {
            "name": "exit",
            "type": 0,
          },
          "kind": 11,
          "label": "exit",
        },
        Object {
          "data": Object {
            "name": "export",
            "type": 0,
          },
          "kind": 11,
          "label": "export",
        },
        Object {
          "data": Object {
            "name": "false",
            "type": 0,
          },
          "kind": 11,
          "label": "false",
        },
        Object {
          "data": Object {
            "name": "fc",
            "type": 0,
          },
          "kind": 11,
          "label": "fc",
        },
        Object {
          "data": Object {
            "name": "fg",
            "type": 0,
          },
          "kind": 11,
          "label": "fg",
        },
        Object {
          "data": Object {
            "name": "getopts",
            "type": 0,
          },
          "kind": 11,
          "label": "getopts",
        },
        Object {
          "data": Object {
            "name": "hash",
            "type": 0,
          },
          "kind": 11,
          "label": "hash",
        },
        Object {
          "data": Object {
            "name": "help",
            "type": 0,
          },
          "kind": 11,
          "label": "help",
        },
        Object {
          "data": Object {
            "name": "history",
            "type": 0,
          },
          "kind": 11,
          "label": "history",
        },
        Object {
          "data": Object {
            "name": "jobs",
            "type": 0,
          },
          "kind": 11,
          "label": "jobs",
        },
        Object {
          "data": Object {
            "name": "kill",
            "type": 0,
          },
          "kind": 11,
          "label": "kill",
        },
        Object {
          "data": Object {
            "name": "let",
            "type": 0,
          },
          "kind": 11,
          "label": "let",
        },
        Object {
          "data": Object {
            "name": "local",
            "type": 0,
          },
          "kind": 11,
          "label": "local",
        },
        Object {
          "data": Object {
            "name": "logout",
            "type": 0,
          },
          "kind": 11,
          "label": "logout",
        },
        Object {
          "data": Object {
            "name": "popd",
            "type": 0,
          },
          "kind": 11,
          "label": "popd",
        },
        Object {
          "data": Object {
            "name": "printf",
            "type": 0,
          },
          "kind": 11,
          "label": "printf",
        },
        Object {
          "data": Object {
            "name": "pushd",
            "type": 0,
          },
          "kind": 11,
          "label": "pushd",
        },
        Object {
          "data": Object {
            "name": "pwd",
            "type": 0,
          },
          "kind": 11,
          "label": "pwd",
        },
        Object {
          "data": Object {
            "name": "read",
            "type": 0,
          },
          "kind": 11,
          "label": "read",
        },
        Object {
          "data": Object {
            "name": "readonly",
            "type": 0,
          },
          "kind": 11,
          "label": "readonly",
        },
        Object {
          "data": Object {
            "name": "return",
            "type": 0,
          },
          "kind": 11,
          "label": "return",
        },
        Object {
          "data": Object {
            "name": "set",
            "type": 0,
          },
          "kind": 11,
          "label": "set",
        },
        Object {
          "data": Object {
            "name": "shift",
            "type": 0,
          },
          "kind": 11,
          "label": "shift",
        },
        Object {
          "data": Object {
            "name": "shopt",
            "type": 0,
          },
          "kind": 11,
          "label": "shopt",
        },
        Object {
          "data": Object {
            "name": "source",
            "type": 0,
          },
          "kind": 11,
          "label": "source",
        },
        Object {
          "data": Object {
            "name": "suspend",
            "type": 0,
          },
          "kind": 11,
          "label": "suspend",
        },
        Object {
          "data": Object {
            "name": "test",
            "type": 0,
          },
          "kind": 11,
          "label": "test",
        },
        Object {
          "data": Object {
            "name": "times",
            "type": 0,
          },
          "kind": 11,
          "label": "times",
        },
        Object {
          "data": Object {
            "name": "trap",
            "type": 0,
          },
          "kind": 11,
          "label": "trap",
        },
        Object {
          "data": Object {
            "name": "true",
            "type": 0,
          },
          "kind": 11,
          "label": "true",
        },
        Object {
          "data": Object {
            "name": "type",
            "type": 0,
          },
          "kind": 11,
          "label": "type",
        },
        Object {
          "data": Object {
            "name": "typeset",
            "type": 0,
          },
          "kind": 11,
          "label": "typeset",
        },
        Object {
          "data": Object {
            "name": "ulimit",
            "type": 0,
          },
          "kind": 11,
          "label": "ulimit",
        },
        Object {
          "data": Object {
            "name": "umask",
            "type": 0,
          },
          "kind": 11,
          "label": "umask",
        },
        Object {
          "data": Object {
            "name": "unalias",
            "type": 0,
          },
          "kind": 11,
          "label": "unalias",
        },
        Object {
          "data": Object {
            "name": "unset",
            "type": 0,
          },
          "kind": 11,
          "label": "unset",
        },
        Object {
          "data": Object {
            "name": "wait",
            "type": 0,
          },
          "kind": 11,
          "label": "wait",
        },
      ]
    `)
  })

  it('responds to onCompletion with all variables when starting to expand parameters', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

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
      lsp.CompletionItemKind.Variable,
    ])
  })
})
