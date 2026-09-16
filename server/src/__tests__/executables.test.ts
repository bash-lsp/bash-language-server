import * as fs from 'fs'
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

describe('symbolic links', () => {
  let rootPath: string
  let binPath: string

  beforeEach(() => {
    rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'bash-language-server-executables-'))
    binPath = path.join(rootPath, 'bin')
    fs.mkdirSync(binPath)
    fs.writeFileSync(path.join(binPath, 'command'), '#!/bin/sh\n', { mode: 0o755 })
  })

  afterEach(() => {
    fs.rmSync(rootPath, { recursive: true, force: true })
  })

  it('preserves the names of symlinked commands', async () => {
    fs.symlinkSync('command', path.join(binPath, 'alias'))
    fs.symlinkSync('alias', path.join(binPath, 'another-alias'))

    const result = await Executables.fromPath(binPath)

    expect(result.list().sort()).toEqual(['alias', 'another-alias', 'command'])
    expect(result.isExecutableOnPATH('alias')).toBe(true)
  })

  it('finds commands in symlinked PATH directories', async () => {
    const linkPath = path.join(rootPath, 'linked-bin')
    fs.symlinkSync(binPath, linkPath, process.platform === 'win32' ? 'junction' : 'dir')

    const result = await Executables.fromPath(linkPath)

    expect(result.list()).toEqual(['command'])
  })

  it('accepts a symlinked executable as a PATH entry', async () => {
    const linkPath = path.join(rootPath, 'alias')
    fs.symlinkSync(path.join(binPath, 'command'), linkPath)

    const result = await Executables.fromPath(linkPath)

    expect(result.list()).toEqual(['alias'])
  })

  it('ignores broken links, link cycles, directories, and non-executable targets', async () => {
    fs.writeFileSync(path.join(rootPath, 'not-executable'), '', { mode: 0o644 })
    fs.symlinkSync('../not-executable', path.join(binPath, 'not-executable'))
    fs.symlinkSync('missing', path.join(binPath, 'broken'))
    fs.symlinkSync('cycle', path.join(binPath, 'cycle'))
    fs.symlinkSync(binPath, path.join(binPath, 'directory'))

    const result = await Executables.fromPath(binPath)

    expect(result.list()).toEqual(['command'])
  })
})

describe('absolute executable access', () => {
  it.each([
    { mode: 0o754, canExecute: false },
    { mode: 0o645, canExecute: true },
  ])('uses caller access for mode $mode', async ({ mode, canExecute }) => {
    const executables = await Executables.fromPath('')
    const stat = jest.spyOn(fs.promises, 'stat').mockResolvedValue({
      isFile: () => true,
      mode,
    } as fs.Stats)
    const access = jest.spyOn(fs.promises, 'access')
    if (canExecute) {
      access.mockResolvedValue(undefined)
    } else {
      access.mockRejectedValue(new Error('EACCES'))
    }
    try {
      expect(await executables.isExecutable('/root-owned-command')).toBe(canExecute)
      expect(access).toHaveBeenCalledWith('/root-owned-command', fs.constants.X_OK)
    } finally {
      stat.mockRestore()
      access.mockRestore()
    }
  })
})

describe('Windows absolute executable access', () => {
  it.each([
    '//server/share/command',
    String.raw`\\server\share\command`,
    String.raw`/\server\share\command`,
    String.raw`\\?\UNC\server\share\command`,
    String.raw`\\?\C:\command`,
    String.raw`\\.\C:\command`,
    String.raw`\??\UNC\server\share\command`,
  ])('does not probe network or device paths: %s', async (command) => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const isAbsolute = jest
      .spyOn(path, 'isAbsolute')
      .mockImplementation(path.win32.isAbsolute)
    const stat = jest.spyOn(fs.promises, 'stat').mockResolvedValue({
      isFile: () => true,
    } as fs.Stats)
    const access = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined)
    try {
      expect(await executables.isExecutable(command)).toBe(false)
      expect(stat).not.toHaveBeenCalled()
      expect(access).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(process, 'platform', platform)
      isAbsolute.mockRestore()
      stat.mockRestore()
      access.mockRestore()
    }
  })

  it('still checks ordinary local Windows paths', async () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const isAbsolute = jest
      .spyOn(path, 'isAbsolute')
      .mockImplementation(path.win32.isAbsolute)
    const stat = jest.spyOn(fs.promises, 'stat').mockResolvedValue({
      isFile: () => true,
    } as fs.Stats)
    const access = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined)
    const command = String.raw`C:\tools\command`
    try {
      expect(await executables.isExecutable(command)).toBe(true)
      expect(stat).toHaveBeenCalledWith(command)
      expect(access).toHaveBeenCalledWith(command, fs.constants.X_OK)
    } finally {
      Object.defineProperty(process, 'platform', platform)
      isAbsolute.mockRestore()
      stat.mockRestore()
      access.mockRestore()
    }
  })
})
