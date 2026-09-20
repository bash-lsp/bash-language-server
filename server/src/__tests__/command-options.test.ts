import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as childProcess from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'

import { getCommandOptions } from '../server'

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
}))

const INVALID_COMMAND_NAMES = [
  '',
  './cat',
  '../cat',
  '/tmp/cat',
  'bin/cat',
  '.cat',
  '-cat',
  '+cat',
  'cat --help',
  'cat\n',
  'cat\r',
  'cat\t',
  'cat\0',
  'cat\\name',
  '"cat"',
  "'cat'",
  '$COMMAND',
  '$(cat)',
  '`cat`',
  'cat;id',
  'écho',
]

describe('getCommandOptions', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(INVALID_COMMAND_NAMES)('rejects %j before spawning a helper', (name) => {
    const spawn = vi.spyOn(childProcess, 'spawnSync').mockReturnValue({
      status: 0,
      stdout: Buffer.from('--help\t'),
    } as any)

    expect(getCommandOptions(name, '-')).toEqual([])
    expect(spawn).not.toHaveBeenCalled()
  })

  it.each(['cat', 'git', 'python3.12', '7z', '_tool', 'my-tool', 'g++'])(
    'preserves option completion for %j',
    (name) => {
      const spawn = vi.spyOn(childProcess, 'spawnSync').mockReturnValue({
        status: 0,
        stdout: Buffer.from('--help\t--version\t'),
      } as any)

      expect(getCommandOptions(name, '-')).toEqual(['--help', '--version'])
      expect(spawn).toHaveBeenCalledWith(path.resolve(__dirname, '../get-options.sh'), [
        name,
        '-',
      ])
    },
  )
})

describe('get-options.sh', () => {
  let directory: string
  let workspace: string
  let sentinel: string
  let completionCwd: string
  let env: NodeJS.ProcessEnv

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'bash-lsp-options-'))
    workspace = path.join(directory, 'workspace')
    sentinel = path.join(directory, 'executed')
    completionCwd = path.join(directory, 'completion-cwd')
    const bin = path.join(directory, 'bin')
    const completions = path.join(directory, 'completion', 'completions')
    for (const dir of [workspace, bin, completions, path.join(directory, 'tmp')]) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(
      path.join(bin, 'pkg-config'),
      '#!/bin/sh\nprintf "%s\\n" "$TEST_COMPLETIONS_DIR"\n',
      { mode: 0o700 },
    )
    writeFileSync(path.join(bin, 'cat'), '#!/bin/sh\nexit 0\n', { mode: 0o700 })
    writeFileSync(
      path.join(workspace, 'cat'),
      '#!/bin/sh\nprintf executed > "$TEST_SENTINEL"\n',
      { mode: 0o700 },
    )
    // Model bash-completion dispatching a registered command to _longopt,
    // which executes the original command name even without the opt-in flag.
    writeFileSync(
      path.join(completions, '..', 'bash_completion'),
      `pwd -P > "$TEST_COMPLETION_CWD"
_longopt() {
  "$1" --help >/dev/null
  COMPREPLY=(--help --version)
}
_command_offset() {
  _longopt "\${COMP_WORDS[0]}"
}
`,
    )
    env = {
      ...process.env,
      PATH: `${bin}:/usr/bin:/bin`,
      TMPDIR: path.join(directory, 'tmp'),
      TEST_COMPLETIONS_DIR: completions,
      TEST_COMPLETION_CWD: completionCwd,
      TEST_SENTINEL: sentinel,
    }
    delete env.BASH_LSP_COMPLETE_LONGOPTS
  })

  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  function runHelper(name: string) {
    return childProcess.spawnSync(
      path.resolve(__dirname, '../get-options.sh'),
      [name, '-'],
      {
        cwd: workspace,
        env,
        encoding: 'utf8',
        timeout: 5000,
      },
    )
  }

  it.each([undefined, '0', '1'])(
    'rejects executable paths with BASH_LSP_COMPLETE_LONGOPTS=%s',
    (flag) => {
      if (flag !== undefined) env.BASH_LSP_COMPLETE_LONGOPTS = flag
      for (const name of ['./cat', '../workspace/cat', path.join(workspace, 'cat')]) {
        const result = runHelper(name)

        expect(existsSync(sentinel)).toBe(false)
        expect(result.status).toBe(1)
        expect(result.stdout).toBe('')
        expect(existsSync(completionCwd)).toBe(false)
      }
    },
  )

  it.each(INVALID_COMMAND_NAMES.filter((name) => !name.includes('\0')))(
    'rejects %j when invoked directly',
    (name) => {
      const result = runHelper(name)

      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(existsSync(completionCwd)).toBe(false)
    },
  )

  it.each(['absolute', 'relative'])(
    'completes PATH commands in a temporary directory and cleans up with %s TMPDIR',
    (kind) => {
      const tempRoot = env.TMPDIR as string
      if (kind === 'relative') env.TMPDIR = path.relative('/', tempRoot)
      // Empty and relative PATH entries must not resolve workspace programs.
      env.PATH = `:.:${env.PATH}`
      const result = runHelper('cat')

      expect(result.status).toBe(0)
      expect(result.stdout).toBe('--help\t--version\t')
      expect(existsSync(sentinel)).toBe(false)
      const cwd = readFileSync(completionCwd, 'utf8').trim()
      expect(path.dirname(cwd)).toBe(realpathSync(tempRoot))
      expect(existsSync(cwd)).toBe(false)
    },
  )

  it('cleans up the temporary directory when bash-completion is unavailable', () => {
    rmSync(path.join(env.TEST_COMPLETIONS_DIR as string, '..', 'bash_completion'))

    const result = runHelper('cat')

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(readdirSync(env.TMPDIR as string)).toEqual([])
  })

  it('does not load completions when creating a temporary directory fails', () => {
    env.TMPDIR = path.join(directory, 'missing')

    const result = runHelper('cat')

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(existsSync(completionCwd)).toBe(false)
    expect(existsSync(sentinel)).toBe(false)
  })
})
