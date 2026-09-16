import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { MAX_ANALYZED_FILE_BYTES, readFileForAnalysis } from '../read-file'

let directory: string
let file: string
const itPosix = process.platform === 'win32' ? it.skip : it

beforeEach(() => {
  directory = fs.mkdtempSync(join(tmpdir(), 'bash-read-'))
  file = join(directory, 'script.sh')
})

afterEach(() => {
  jest.restoreAllMocks()
  fs.rmSync(directory, { recursive: true, force: true })
})

it.each(['', 'value=é😀\n'])('reads a regular UTF-8 file: %p', async (content) => {
  fs.writeFileSync(file, content)
  expect(await readFileForAnalysis(pathToFileURL(file))).toBe(content)
})

itPosix('allows symlinks to regular files', async () => {
  fs.writeFileSync(file, 'value=ok')
  const link = join(directory, 'link.sh')
  fs.symlinkSync(file, link)
  expect(await readFileForAnalysis(link)).toBe('value=ok')
})

it('rejects oversized files before reading and closes the handle', async () => {
  fs.writeFileSync(file, '')
  fs.truncateSync(file, MAX_ANALYZED_FILE_BYTES + 1)
  const handle = await fs.promises.open(file, 'r')
  jest.spyOn(fs.promises, 'open').mockResolvedValueOnce(handle)
  const read = jest.spyOn(handle, 'read')
  const close = jest.spyOn(handle, 'close')
  await expect(readFileForAnalysis(file)).rejects.toThrow('larger than')
  expect(read).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledTimes(1)
})

it.each(['grow', 'shrink', 'replace'])(
  'bounds reads to the inspected handle when a file changes: %s',
  async (change) => {
    fs.writeFileSync(file, 'value=old')
    const handle = await fs.promises.open(file, 'r')
    const stat = await handle.stat()
    jest.spyOn(fs.promises, 'open').mockResolvedValueOnce(handle)
    jest.spyOn(handle, 'stat').mockImplementationOnce(async () => {
      if (change === 'grow') fs.appendFileSync(file, '\nvalue=new')
      if (change === 'shrink') fs.truncateSync(file, 5)
      if (change === 'replace') {
        fs.renameSync(file, join(directory, 'previous.sh'))
        fs.writeFileSync(file, 'value=new')
      }
      return stat
    })
    const close = jest.spyOn(handle, 'close')
    expect(await readFileForAnalysis(file)).toBe(
      change === 'shrink' ? 'value' : 'value=old',
    )
    expect(close).toHaveBeenCalledTimes(1)
  },
)

it('closes the handle when reading fails', async () => {
  fs.writeFileSync(file, 'value=old')
  const handle = await fs.promises.open(file, 'r')
  jest.spyOn(fs.promises, 'open').mockResolvedValueOnce(handle)
  jest.spyOn(handle, 'read').mockRejectedValueOnce(new Error('read failed'))
  const close = jest.spyOn(handle, 'close')
  await expect(readFileForAnalysis(file)).rejects.toThrow('read failed')
  expect(close).toHaveBeenCalledTimes(1)
})
itPosix(
  'rejects device symlinks and FIFOs without reading or waiting for a writer',
  async () => {
    fs.symlinkSync('/dev/zero', file)
    await expect(readFileForAnalysis(file)).rejects.toThrow('non-regular')
    fs.unlinkSync(file)
    execFileSync('mkfifo', [file])
    await expect(readFileForAnalysis(file)).rejects.toThrow('non-regular')
  },
)
