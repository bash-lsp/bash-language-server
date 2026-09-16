import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import Executables from '../executables'

let executables: Executables

beforeAll(async () => {
  executables = await Executables.fromPath(
    path.resolve(__dirname, '..', '..', '..', 'testing', 'executables'),
  )
})

describe('list', () => {
  it('finds executables on the PATH', async () => {
    const result = executables.list().find((x) => x === 'iam-executable')
    expect(result).toBeTruthy()
  })

  it.skip('only considers files that have the executable bit set', async () => {
    const result = executables.list().find((x) => x === 'iam-not-executable')
    expect(result).toBeFalsy()
  })

  it('only considers executable directly on the PATH', async () => {
    const result = executables.list().find((x) => x === 'iam-executable-in-sub-folder')
    expect(result).toBeFalsy()
  })
})

describe('isExecutableOnPATH', () => {
  it('looks at the PATH it has been initialized with', async () => {
    const result = executables.isExecutableOnPATH('ls')
    expect(result).toEqual(false)
  })
})

describe('symlinks on PATH', () => {
  let directory: string

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bash-lsp-executables-'))
    await fs.mkdir(path.join(directory, 'bin'))
    await fs.writeFile(path.join(directory, 'bin', 'command'), '#!/bin/sh\n', {
      mode: 0o755,
    })
  })

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('finds commands in symlinked PATH directories', async () => {
    const profile = path.join(directory, 'profile')
    await fs.symlink(path.join(directory, 'bin'), profile)

    expect((await Executables.fromPath(profile)).list()).toEqual(['command'])
  })

  it('follows executable links while ignoring broken and non-executable links', async () => {
    const bin = path.join(directory, 'bin')
    await fs.symlink('command', path.join(bin, 'linked-command'))
    await fs.symlink('missing', path.join(bin, 'broken'))
    await fs.symlink('.', path.join(bin, 'directory'))
    await fs.writeFile(path.join(bin, 'data'), '', { mode: 0o644 })
    await fs.symlink('data', path.join(bin, 'linked-data'))

    expect((await Executables.fromPath(bin)).list().sort()).toEqual([
      'command',
      'linked-command',
    ])
  })
})
