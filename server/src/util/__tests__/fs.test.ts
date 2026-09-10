import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { getFilePaths } from '../fs'

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
})
