import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { getFilePaths } from '../fs'

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
}))

const symlinkType = process.platform === 'win32' ? 'junction' : 'dir'

const relativePaths = (filePaths: string[], rootPath: string): string[] =>
  filePaths.map((filePath) => path.relative(rootPath, filePath).split(path.sep).join('/'))

describe('getFilePaths', () => {
  let rootPath: string

  beforeEach(() => {
    rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'bash-language-server-fs-'))
  })

  afterEach(() => {
    fs.rmSync(rootPath, { recursive: true, force: true })
  })

  it('returns the paths of files matching the glob pattern', async () => {
    fs.writeFileSync(path.join(rootPath, 'script.sh'), '')
    fs.mkdirSync(path.join(rootPath, 'nested'))
    fs.writeFileSync(path.join(rootPath, 'nested', 'nested.sh'), '')

    const filePaths = await getFilePaths({
      globPattern: '**/*.sh',
      rootPath,
      maxItems: 100,
    })

    expect(relativePaths(filePaths, rootPath).sort()).toEqual([
      'nested/nested.sh',
      'script.sh',
    ])
  })

  it('follows symbolic links to directories', async () => {
    const targetPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bash-language-server-fs-target-'),
    )

    try {
      fs.writeFileSync(path.join(targetPath, 'linked.sh'), '')
      fs.symlinkSync(targetPath, path.join(rootPath, 'link'), symlinkType)

      const filePaths = await getFilePaths({
        globPattern: '**/*.sh',
        rootPath,
        maxItems: 100,
      })

      expect(relativePaths(filePaths, rootPath)).toEqual(['link/linked.sh'])
    } finally {
      fs.rmSync(targetPath, { recursive: true, force: true })
    }
  })

  it('follows several symbolic links to the same directory', async () => {
    const targetPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bash-language-server-fs-target-'),
    )

    try {
      fs.writeFileSync(path.join(targetPath, 'shared.sh'), '')
      fs.symlinkSync(targetPath, path.join(rootPath, 'a'), symlinkType)
      fs.symlinkSync(targetPath, path.join(rootPath, 'b'), symlinkType)

      const filePaths = await getFilePaths({
        globPattern: '{a,b}/**/*.sh',
        rootPath,
        maxItems: 100,
      })

      expect(relativePaths(filePaths, rootPath).sort()).toEqual([
        'a/shared.sh',
        'b/shared.sh',
      ])
    } finally {
      fs.rmSync(targetPath, { recursive: true, force: true })
    }
  })

  it('does not follow cyclic symbolic links', async () => {
    fs.writeFileSync(path.join(rootPath, 'script.sh'), '')

    const loopPath = path.join(rootPath, 'loop')
    fs.symlinkSync(rootPath, loopPath, symlinkType)

    try {
      const filePaths = await getFilePaths({
        globPattern: '**/*.sh',
        rootPath,
        maxItems: 100,
      })

      expect(relativePaths(filePaths, rootPath)).toEqual(['script.sh'])
    } finally {
      fs.unlinkSync(loopPath)
    }
  })

  it('does not follow cyclic symbolic links to an ancestor', async () => {
    fs.mkdirSync(path.join(rootPath, 'nested'))
    fs.writeFileSync(path.join(rootPath, 'nested', 'nested.sh'), '')

    const loopPath = path.join(rootPath, 'nested', 'loop')
    fs.symlinkSync(rootPath, loopPath, symlinkType)

    try {
      const filePaths = await getFilePaths({
        globPattern: '**/*.sh',
        rootPath,
        maxItems: 100,
      })

      expect(relativePaths(filePaths, rootPath)).toEqual(['nested/nested.sh'])
    } finally {
      fs.unlinkSync(loopPath)
    }
  })

  it('stops after the maximum number of files', async () => {
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(path.join(rootPath, `script-${i}.sh`), '')
    }

    const filePaths = await getFilePaths({
      globPattern: '**/*.sh',
      rootPath,
      maxItems: 3,
    })

    expect(filePaths).toHaveLength(3)
  })

  it('stops walking once the limit is reached even without another match', async () => {
    fs.writeFileSync(path.join(rootPath, 'script.sh'), '')
    let nestedPath = rootPath
    for (let i = 0; i < 30; i++) {
      nestedPath = path.join(nestedPath, 'nested')
      fs.mkdirSync(nestedPath)
    }
    fs.writeFileSync(path.join(nestedPath, 'unrelated.txt'), '')

    const readdir = vi.spyOn(fs, 'readdir')
    try {
      const filePaths = await getFilePaths({
        globPattern: '**/*.sh',
        rootPath,
        maxItems: 1,
      })

      expect(relativePaths(filePaths, rootPath)).toEqual(['script.sh'])
      expect(readdir.mock.calls.map(([directoryPath]) => directoryPath)).not.toContain(
        nestedPath,
      )
    } finally {
      readdir.mockRestore()
    }
  })

  it('does not start walking when the maximum is zero', async () => {
    fs.writeFileSync(path.join(rootPath, 'script.sh'), '')
    const readdir = vi.spyOn(fs, 'readdir')
    try {
      const filePaths = await getFilePaths({
        globPattern: '**/*.sh',
        rootPath,
        maxItems: 0,
      })

      expect(filePaths).toEqual([])
      expect(readdir).not.toHaveBeenCalled()
    } finally {
      readdir.mockRestore()
    }
  })
  it('bounds directory reads when there are no matching files', async () => {
    for (let i = 0; i < 40; i++) {
      fs.mkdirSync(path.join(rootPath, `directory-${i}`, 'nested'), { recursive: true })
    }
    const readdir = vi.spyOn(fs, 'readdir')
    const onLimit = vi.fn()
    try {
      const files = await getFilePaths({
        rootPath,
        globPattern: '**/*.sh',
        maxItems: 500,
        maxDirectories: 5,
        onLimit,
      })
      expect(files).toEqual([])
      expect(readdir).toHaveBeenCalledTimes(5)
      expect(onLimit.mock.calls).toEqual([['directories']])
    } finally {
      readdir.mockRestore()
    }
  })

  it('skips excluded directories while preserving other nested scripts', async () => {
    for (const folder of ['build', 'src']) {
      fs.mkdirSync(path.join(rootPath, folder))
      fs.writeFileSync(path.join(rootPath, folder, 'script.sh'), '')
    }
    const readdir = vi.spyOn(fs, 'readdir')
    try {
      const files = await getFilePaths({
        rootPath,
        globPattern: '**/*.sh',
        maxItems: 500,
        ignore: ['**/build/**'],
      })
      expect(relativePaths(files, rootPath)).toEqual(['src/script.sh'])
      expect(readdir.mock.calls.map(([directory]) => directory)).not.toContain(
        path.join(rootPath, 'build'),
      )
    } finally {
      readdir.mockRestore()
    }
  })

  it('does no filesystem work when already canceled', async () => {
    const controller = new AbortController()
    controller.abort()
    const readdir = vi.spyOn(fs, 'readdir')
    try {
      await expect(
        getFilePaths({
          rootPath,
          globPattern: '**/*.sh',
          maxItems: 500,
          signal: controller.signal,
        }),
      ).resolves.toEqual([])
      expect(readdir).not.toHaveBeenCalled()
    } finally {
      readdir.mockRestore()
    }
  })

  it.each(['abort', 'timeout'] as const)(
    'settles a scan with a pending directory read on %s',
    async (reason) => {
      let readStarted: () => void = () => undefined
      const started = new Promise<void>((resolve) => {
        readStarted = resolve
      })
      let completeRead: (() => void) | undefined
      const readdir = vi.spyOn(fs, 'readdir').mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1]
        completeRead = () => callback(null, [])
        readStarted()
      })
      const controller = new AbortController()
      const onLimit = vi.fn()
      try {
        const pending = getFilePaths({
          rootPath,
          globPattern: '**/*.sh',
          maxItems: 500,
          timeoutMs: 100,
          signal: controller.signal,
          onLimit,
        })
        await started
        expect(completeRead).toBeDefined()
        if (reason === 'abort') controller.abort()
        await expect(pending).resolves.toEqual([])
        expect(onLimit.mock.calls).toEqual(reason === 'timeout' ? [['time']] : [])
      } finally {
        controller.abort()
        completeRead?.()
        readdir.mockRestore()
      }
    },
  )
  it('does not process late directory entries after cancellation', async () => {
    for (let i = 0; i < 20; i++) {
      fs.symlinkSync(rootPath, path.join(rootPath, `link-${i}`), symlinkType)
    }
    const entries = fs.readdirSync(rootPath, { withFileTypes: true })
    let releaseRead: () => void = () => undefined
    let readStarted: () => void = () => undefined
    const started = new Promise<void>((resolve) => {
      readStarted = resolve
    })
    const readdir = vi.spyOn(fs, 'readdir').mockImplementation((...args: any[]) => {
      releaseRead = () => args[args.length - 1](null, entries)
      readStarted()
    })
    const inspectEntries = entries.map((entry) => vi.spyOn(entry, 'isSymbolicLink'))
    const controller = new AbortController()
    try {
      const pending = getFilePaths({
        rootPath,
        globPattern: '**/*.sh',
        maxItems: 500,
        signal: controller.signal,
      })
      await started
      controller.abort()
      await pending
      await new Promise((resolve) => setImmediate(resolve))
      releaseRead()
      await new Promise((resolve) => setImmediate(resolve))
      for (const inspect of inspectEntries) expect(inspect).not.toHaveBeenCalled()
    } finally {
      readdir.mockRestore()
      for (const inspect of inspectEntries) inspect.mockRestore()
    }
  })
})
