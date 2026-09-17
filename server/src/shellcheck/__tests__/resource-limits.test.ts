import childProcess from 'node:child_process'

import { TextDocument } from 'vscode-languageserver-textdocument'

import { Logger } from '../../util/logger'
import { Linter } from '../index'

const { spawn } = childProcess
// Windows does not support ignoring SIGTERM or Unix process groups.
const itPosix = process.platform === 'win32' ? it.skip : it
const document = (text: string, name: string) =>
  TextDocument.create(`file:///tmp/${name}.sh`, 'shellscript', 1, text)

describe('ShellCheck resource limits', () => {
  let children: childProcess.ChildProcess[]
  let descendants: number[]
  let ready: Promise<void>[]
  let exits: Promise<void>[]
  let linters: Linter[]
  let peakRunning: number
  let running: number

  beforeEach(() => {
    jest.useFakeTimers()
    children = []
    descendants = []
    ready = []
    exits = []
    linters = []
    peakRunning = running = 0
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(childProcess, 'spawn').mockImplementation((_command, _args, options) => {
      const child = spawn(
        process.execPath,
        [
          '-e',
          `
        let text = '';
        process.stdin.on('data', chunk => { text += chunk });
        process.stdin.on('end', () => {
          if (text.includes('wrapper')) {
            const separateOutput = text.includes('separate-output');
            const script = "process.on('SIGTERM', () => {}); process.send(process.pid); setInterval(() => {}, 1000)";
            const child = require('node:child_process').spawn(process.execPath, ['-e', script], {
              stdio: ['ignore', separateOutput ? 'ignore' : 'inherit', separateOutput ? 'ignore' : 'inherit', 'ipc'],
              detached: text.includes('detached'),
            });
            child.on('message', pid => process.stderr.write('descendant:' + pid));
            return;
          }
          if (text.includes('ignore-term')) process.on('SIGTERM', () => {});
          process.stderr.write('ready');
          if (text.includes('hold')) setInterval(() => {}, 1000);
          else process.stdout.write(JSON.stringify({ comments: [] }));
        });
      `,
        ],
        options,
      )
      children.push(child)
      running++
      peakRunning = Math.max(peakRunning, running)
      ready.push(
        new Promise((resolve) =>
          child.stderr!.once('data', (data) => {
            const match = String(data).match(/descendant:(\d+)/)
            if (match) descendants.push(Number(match[1]))
            resolve()
          }),
        ),
      )
      exits.push(
        new Promise((resolve) =>
          child.once('close', () => {
            running--
            resolve()
          }),
        ),
      )
      jest.spyOn(child.stdin!, 'end')
      return child
    })
  })

  afterEach(async () => {
    for (const linter of linters) linter.dispose()
    for (const pid of descendants) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }
    await Promise.all(exits)
    await jest.advanceTimersByTimeAsync(0)
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  function linter(maxConcurrent = 1, timeoutMs = 10000) {
    const instance = new Linter({
      executablePath: 'controlled-checker',
      maxConcurrent,
      timeoutMs,
    })
    linters.push(instance)
    return instance
  }

  it('limits running processes across documents and starts waiting work when a slot frees', async () => {
    const checker = linter(2)
    const first = checker.lint(document('hold', 'first'), [])
    const second = checker.lint(document('hold', 'second'), [])
    const third = checker.lint(document('latest', 'third'), [])
    jest.advanceTimersByTime(500)
    expect(children).toHaveLength(2)
    await Promise.all(ready)

    checker.cancel('file:///tmp/first.sh')
    expect(await first).toBeNull()
    expect(await third).toEqual({ diagnostics: [], codeActions: {} })
    expect(children).toHaveLength(3)
    expect(peakRunning).toBe(2)
    checker.cancel('file:///tmp/second.sh')
    expect(await second).toBeNull()
  })

  it('replaces queued revisions without ever spawning the obsolete checker', async () => {
    const checker = linter()
    const runningJob = checker.lint(document('hold', 'running'), [])
    jest.advanceTimersByTime(500)
    await ready[0]
    const obsolete = checker.lint(document('obsolete', 'queued'), [])
    jest.advanceTimersByTime(500)
    const latest = checker.lint(document('latest', 'queued'), [])
    jest.advanceTimersByTime(500)
    expect(await obsolete).toBeNull()
    expect(children).toHaveLength(1)

    checker.cancel('file:///tmp/running.sh')
    await runningJob
    expect(await latest).toEqual({ diagnostics: [], codeActions: {} })
    expect(children).toHaveLength(2)
    expect(children[1].stdin!.end).toHaveBeenCalledWith('latest')
    expect(peakRunning).toBe(1)
  })

  itPosix(
    'times out and force-kills an uncooperative checker before reusing its slot',
    async () => {
      const checker = linter(1, 1000)
      const warning = jest.spyOn(Logger.prototype, 'warn')
      const expired = checker.lint(document('hold ignore-term', 'expired'), [])
      jest.advanceTimersByTime(500)
      await ready[0]
      const next = checker.lint(document('latest', 'next'), [])
      jest.advanceTimersByTime(1000)
      expect(await expired).toBeNull()
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining('timed out after 1000ms'),
      )
      expect(children).toHaveLength(1)
      expect(children[0].signalCode).toBeNull()

      jest.advanceTimersByTime(1000)
      await exits[0]
      expect(await next).toEqual({ diagnostics: [], codeActions: {} })
      expect(children[0].signalCode).toBe('SIGKILL')
      expect(peakRunning).toBe(1)
    },
  )

  itPosix(
    'does not report a canceled checker as timed out while waiting for it to exit',
    async () => {
      const checker = linter(1, 1000)
      const warning = jest.spyOn(Logger.prototype, 'warn')
      const canceled = checker.lint(document('hold ignore-term', 'canceled'), [])
      jest.advanceTimersByTime(500)
      await ready[0]
      jest.advanceTimersByTime(600)
      checker.cancel('file:///tmp/canceled.sh')
      expect(await canceled).toBeNull()
      const next = checker.lint(document('latest', 'next'), [])

      // Its original deadline expires during the cancellation grace period.
      jest.advanceTimersByTime(500)
      expect(warning).not.toHaveBeenCalled()
      expect(children).toHaveLength(1)
      expect(children[0].signalCode).toBeNull()

      jest.advanceTimersByTime(500)
      await exits[0]
      expect(await next).toEqual({ diagnostics: [], codeActions: {} })
      expect(children[0].signalCode).toBe('SIGKILL')
      expect(peakRunning).toBe(1)
    },
  )

  itPosix(
    'shares slots with a replacement linter until disposed processes exit',
    async () => {
      const oldChecker = linter()
      const old = oldChecker.lint(document('hold ignore-term', 'old'), [])
      jest.advanceTimersByTime(500)
      await ready[0]
      oldChecker.dispose()
      expect(await old).toBeNull()

      const newChecker = linter()
      const next = newChecker.lint(document('latest', 'new'), [])
      jest.advanceTimersByTime(500)
      expect(children).toHaveLength(1)
      jest.advanceTimersByTime(500)
      await exits[0]
      expect(await next).toEqual({ diagnostics: [], codeActions: {} })
      expect(children[0].signalCode).toBe('SIGKILL')
      expect(peakRunning).toBe(1)
    },
  )

  itPosix.each(['wrapper', 'wrapper detached'])(
    'releases the queue after a timed-out %s exits with inherited pipes still open',
    async (text) => {
      const checker = linter(1, 1000)
      const expired = checker.lint(document(text, 'wrapper'), [])
      jest.advanceTimersByTime(500)
      await ready[0]
      expect(descendants).toHaveLength(1)
      const wrapperExit = new Promise((resolve) => children[0].once('exit', resolve))
      const next = checker.lint(document('latest', 'next'), [])

      jest.advanceTimersByTime(1000)
      expect(await expired).toBeNull()
      await wrapperExit
      expect(children).toHaveLength(1)
      jest.advanceTimersByTime(1000)
      await exits[0]
      expect(await next).toEqual({ diagnostics: [], codeActions: {} })
      expect(children).toHaveLength(2)
      expect(peakRunning).toBe(1)
    },
  )

  itPosix(
    'kills same-group descendants even when their output does not keep the wrapper open',
    async () => {
      const checker = linter(1, 1000)
      const expired = checker.lint(document('wrapper separate-output', 'wrapper'), [])
      jest.advanceTimersByTime(500)
      await ready[0]
      const next = checker.lint(document('latest', 'next'), [])
      jest.advanceTimersByTime(1000)
      expect(await expired).toBeNull()
      await exits[0]
      expect(await next).toEqual({ diagnostics: [], codeActions: {} })

      // A reparented process may briefly remain as a zombie until init reaps it.
      // Either absent or a zombie confirms it has stopped executing.
      let status = ''
      try {
        status = childProcess.execFileSync(
          'ps',
          ['-o', 'stat=', '-p', `${descendants[0]}`],
          {
            encoding: 'utf8',
          },
        )
      } catch (error) {
        expect((error as { status: number }).status).toBe(1)
      }
      expect(status.trim()).toMatch(/^Z?$/)
    },
  )

  it('disposes queued jobs without launching them later', async () => {
    const checker = linter()
    const active = checker.lint(document('hold', 'active'), [])
    const queued = checker.lint(document('latest', 'queued'), [])
    jest.advanceTimersByTime(500)
    await ready[0]
    checker.dispose()
    expect(await Promise.all([active, queued])).toEqual([null, null])
    await exits[0]
    expect(children).toHaveLength(1)
    await expect(
      checker.lint(document('latest', 'after-dispose'), []),
    ).resolves.toBeNull()
  })
})
