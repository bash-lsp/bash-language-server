import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as childProcess from 'child_process'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { getMockConnection } from '../../../../testing/mocks'
import BashServer from '../../server'
import { Linter } from '../index'

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
}))

const { spawn } = childProcess
const uri = 'file:///tmp/lint-lifecycle.sh'
const document = (text: string, documentUri = uri) =>
  TextDocument.create(documentUri, 'shellscript', 1, text)

async function initializeServer() {
  const connection = getMockConnection()
  const server = await BashServer.initialize(connection, {
    rootPath: null,
    rootUri: null,
    processId: 42,
    capabilities: {},
    workspaceFolders: null,
  })
  server.register(connection)
  connection.onDidChangeConfiguration.mock.calls[0][0]({
    settings: { bashIde: { shellcheckPath: 'controlled-shellcheck' } },
  })
  await connection.onInitialized.mock.calls[0][0]({})
  return { connection, server }
}

describe('lint process lifecycle', () => {
  let children: childProcess.ChildProcess[]
  let exits: Promise<void>[]

  beforeEach(() => {
    vi.useFakeTimers()
    children = []
    exits = []
    vi.spyOn(childProcess, 'spawn').mockImplementation((_command, _args, options) => {
      // A controlled slow checker: stale inputs keep running until canceled.
      const child = spawn(
        process.execPath,
        [
          '-e',
          `let text = '';
          process.stdin.on('data', chunk => { text += chunk });
          process.stdin.on('end', () => {
            if (text.includes('invalid')) {
              process.stdout.write('invalid json');
            } else if (text.includes('latest')) {
              process.stdout.write(JSON.stringify({ comments: [] }));
            } else {
              setInterval(() => {}, 1000);
            }
          });`,
        ],
        options,
      )
      children.push(child)
      exits.push(new Promise((resolve) => child.once('close', () => resolve())))
      return child
    })
  })

  afterEach(async () => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
    }
    await Promise.all(exits)
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('cancels a running process when the same document changes after the debounce', async () => {
    const linter = new Linter({ executablePath: 'controlled-shellcheck' })
    const first = linter.lint(document('echo stale'), [])
    vi.advanceTimersByTime(500)
    expect(children).toHaveLength(1)

    const latest = linter.lint(document('echo latest'), [])
    // Cleanup can terminate the checker after a failed assertion.
    void first.catch(() => undefined)
    expect(await first).toBeNull()

    vi.advanceTimersByTime(500)
    expect(await latest).toEqual({ diagnostics: [], codeActions: {} })
    expect(children).toHaveLength(2)
    await exits[0]
    expect(children[0].signalCode).toBe('SIGTERM')
  })

  it('settles superseded requests without spawning their queued processes', async () => {
    const linter = new Linter({ executablePath: 'controlled-shellcheck' })
    const requests = Array.from({ length: 10 }, () =>
      linter.lint(document('echo latest'), []),
    )

    vi.advanceTimersByTime(500)
    expect(await Promise.all(requests)).toEqual([
      ...Array(9).fill(null),
      { diagnostics: [], codeActions: {} },
    ])
    expect(children).toHaveLength(1)
  })

  it('does not cancel a different document', async () => {
    const linter = new Linter({ executablePath: 'controlled-shellcheck' })
    const first = linter.lint(document('echo stale'), [])
    vi.advanceTimersByTime(500)

    const second = linter.lint(document('echo latest', 'file:///tmp/other.sh'), [])
    vi.advanceTimersByTime(500)
    expect(await second).toEqual({ diagnostics: [], codeActions: {} })
    expect(children[0].exitCode).toBeNull()
    expect(children[0].signalCode).toBeNull()

    linter.cancel(uri)
    expect(await first).toBeNull()
    await exits[0]
    expect(children[0].signalCode).toBe('SIGTERM')
  })

  it('does not let an older process completion remove a newer queued request', async () => {
    const linter = new Linter({ executablePath: 'controlled-shellcheck' })
    const first = linter.lint(document('echo stale'), [])
    vi.advanceTimersByTime(500)
    const second = linter.lint(document('echo stale again'), [])
    expect(await first).toBeNull()
    await exits[0]

    const latest = linter.lint(document('echo latest'), [])
    expect(await second).toBeNull()
    vi.advanceTimersByTime(500)
    expect(await latest).toEqual({ diagnostics: [], codeActions: {} })
    expect(children).toHaveLength(2)
  })

  it('disposes running and queued requests', async () => {
    const linter = new Linter({ executablePath: 'controlled-shellcheck' })
    const running = linter.lint(document('echo stale'), [])
    vi.advanceTimersByTime(500)
    const queued = linter.lint(document('echo latest', 'file:///tmp/other.sh'), [])

    linter.dispose()

    expect(await Promise.all([running, queued])).toEqual([null, null])
    await exits[0]
    expect(children[0].signalCode).toBe('SIGTERM')
    vi.advanceTimersByTime(500)
    expect(children).toHaveLength(1)
  })

  it('preserves checker errors and permits subsequent requests', async () => {
    const linter = new Linter({ executablePath: 'controlled-shellcheck' })
    const invalid = linter.lint(document('echo invalid'), [])
    vi.advanceTimersByTime(500)
    await expect(invalid).rejects.toThrow('ShellCheck: json parse failed')

    const latest = linter.lint(document('echo latest'), [])
    vi.advanceTimersByTime(500)
    expect(await latest).toEqual({ diagnostics: [], codeActions: {} })
  })

  it('publishes diagnostics only for the latest document revision', async () => {
    const { connection, server } = await initializeServer()
    const first = server.analyzeAndLintDocument(document('echo stale'))
    vi.advanceTimersByTime(500)

    const latest = server.analyzeAndLintDocument(
      TextDocument.create(uri, 'shellscript', 2, 'echo latest'),
    )
    vi.advanceTimersByTime(500)
    await Promise.all([first, latest])

    expect(connection.sendDiagnostics.mock.calls).toEqual([
      [{ uri, version: 2, diagnostics: [] }],
    ])
  })

  it('cancels on close without republishing diagnostics or relinting a closed document', async () => {
    const { connection, server } = await initializeServer()
    const analyze = vi.spyOn(server, 'analyzeAndLintDocument')
    connection.onDidOpenTextDocument.mock.calls[0][0]({
      textDocument: { uri, languageId: 'shellscript', version: 1, text: 'echo stale' },
    })
    vi.advanceTimersByTime(500)

    connection.onDidCloseTextDocument.mock.calls[0][0]({ textDocument: { uri } })
    await analyze.mock.results[0].value
    await exits[0]
    expect(children[0].signalCode).toBe('SIGTERM')
    expect(connection.sendDiagnostics.mock.calls).toEqual([[{ uri, diagnostics: [] }]])

    connection.onDidChangeConfiguration.mock.calls[0][0]({
      settings: { bashIde: { shellcheckPath: 'another-shellcheck' } },
    })
    vi.advanceTimersByTime(500)
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(children).toHaveLength(1)
  })

  it('cancels the old checker when configuration disables linting', async () => {
    const { connection, server } = await initializeServer()
    const analyze = vi.spyOn(server, 'analyzeAndLintDocument')
    connection.onDidOpenTextDocument.mock.calls[0][0]({
      textDocument: { uri, languageId: 'shellscript', version: 1, text: 'echo stale' },
    })
    vi.advanceTimersByTime(500)

    connection.onDidChangeConfiguration.mock.calls[0][0]({
      settings: { bashIde: { shellcheckPath: '' } },
    })
    await Promise.all(analyze.mock.results.map(({ value }) => value))

    await exits[0]
    expect(children[0].signalCode).toBe('SIGTERM')
    expect(connection.sendDiagnostics.mock.calls).toEqual([
      [{ uri, version: 1, diagnostics: [] }],
    ])
  })

  it.each(['replacement-shellcheck', ''])(
    'refreshes every open document when shellcheckPath changes to "%s"',
    async (shellcheckPath) => {
      const { connection, server } = await initializeServer()
      const analyze = vi.spyOn(server, 'analyzeAndLintDocument')
      const openDocuments = [
        { uri, languageId: 'shellscript', version: 1, text: 'echo latest' },
        {
          uri: 'file:///tmp/other.sh',
          languageId: 'shellscript',
          version: 2,
          text: 'echo latest',
        },
      ]
      for (const textDocument of openDocuments) {
        connection.onDidOpenTextDocument.mock.calls[0][0]({ textDocument })
      }
      vi.advanceTimersByTime(500)
      expect(children).toHaveLength(2)

      connection.onDidChangeConfiguration.mock.calls[0][0]({
        settings: { bashIde: { shellcheckPath } },
      })
      await Promise.all(exits)
      expect(children.every((child) => child.signalCode === 'SIGTERM')).toBe(true)
      vi.advanceTimersByTime(500)
      await Promise.all(analyze.mock.results.map(({ value }) => value))

      expect(connection.sendDiagnostics).toHaveBeenCalledTimes(2)
      for (const { uri: documentUri, version } of openDocuments) {
        expect(connection.sendDiagnostics).toHaveBeenCalledWith({
          uri: documentUri,
          version,
          diagnostics: [],
        })
      }
      expect(children).toHaveLength(shellcheckPath ? 4 : 2)
    },
  )

  it('cancels active checks on server shutdown', async () => {
    const { connection, server } = await initializeServer()
    const pending = server.analyzeAndLintDocument(document('echo stale'))
    vi.advanceTimersByTime(500)

    await connection.onShutdown.mock.calls[0][0]({} as any)
    await pending

    await exits[0]
    expect(children[0].signalCode).toBe('SIGTERM')
    expect(connection.sendDiagnostics).not.toHaveBeenCalled()
  })
})
