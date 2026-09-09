import * as fs from 'node:fs'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

import * as fastGlob from 'fast-glob'

// from https://github.com/sindresorhus/untildify/blob/f85a087418aeaa2beb56fe2684fe3b64fc8c588d/index.js#L11
export function untildify(pathWithTilde: string): string {
  const homeDirectory = os.homedir()
  return homeDirectory
    ? pathWithTilde.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathWithTilde
}

/**
 * Create a file system adapter for `fast-glob` that reads a directory only
 * once, even when it is reachable through multiple (symbolic) links.
 *
 * `fast-glob` follows symbolic links, so a cyclic symbolic link makes it walk
 * the same directory over and over again until the process runs out of memory.
 * Reading every directory by its real path only once breaks such cycles while
 * keeping symbolic links working.
 */
function createCycleSafeFileSystemAdapter(
  readRealPaths: Set<string>,
): Partial<fastGlob.FileSystemAdapter> {
  const isFirstReadOf = (realPath: string): boolean => {
    if (readRealPaths.has(realPath)) {
      return false
    }

    readRealPaths.add(realPath)

    return true
  }

  return {
    readdir: (directoryPath: string, optionsOrCallback: any, callback?: any) => {
      const options =
        typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const done = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

      fs.realpath(directoryPath, (realPathError, realPath) => {
        if (realPathError == null && !isFirstReadOf(realPath)) {
          done(null, [])
          return
        }

        if (options == null) {
          fs.readdir(directoryPath, done)
        } else {
          fs.readdir(directoryPath, options, done)
        }
      })
    },
    readdirSync: (directoryPath: string, options?: any) => {
      try {
        if (!isFirstReadOf(fs.realpathSync(directoryPath))) {
          return []
        }
      } catch {
        // fall through and let `readdirSync` report the error
      }

      return options == null
        ? fs.readdirSync(directoryPath)
        : fs.readdirSync(directoryPath, options)
    },
  } as Partial<fastGlob.FileSystemAdapter>
}

export async function getFilePaths({
  globPattern,
  rootPath,
  maxItems,
}: {
  globPattern: string
  rootPath: string
  maxItems: number
}): Promise<string[]> {
  if (rootPath.startsWith('file://')) {
    rootPath = fileURLToPath(rootPath)
  }

  const stream = fastGlob.stream([globPattern], {
    absolute: true,
    onlyFiles: true,
    cwd: rootPath,
    followSymbolicLinks: true,
    fs: createCycleSafeFileSystemAdapter(new Set<string>()),
    suppressErrors: true,
  })

  // NOTE: we use a stream here to not block the event loop
  // and ensure that we stop reading files if the glob returns
  // too many files.
  const files = []
  let i = 0
  for await (const fileEntry of stream) {
    if (i >= maxItems) {
      // NOTE: Close the stream to stop reading files paths.
      stream.emit('close')
      break
    }

    files.push(fileEntry.toString())
    i++
  }

  return files
}
