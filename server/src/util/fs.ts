import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
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
 * Create a file system adapter for `fast-glob` that stops walking a directory
 * when it links back to one of its own ancestors.
 *
 * `fast-glob` follows symbolic links by default and, like `node-glob`, walks a
 * cyclic symbolic link forever until the process runs out of memory. Upstream
 * tracks this as a known limitation with no fix, and the suggested workarounds
 * (`followSymbolicLinks: false` or a `deep` limit) either drop symlink support
 * or truncate deep trees — see https://github.com/mrmlnc/fast-glob/issues/74.
 *
 * A directory is only skipped when its real path is the real path of one of
 * its ancestors, so symbolic links in general, including several links to the
 * same directory, keep working.
 */
function createCycleSafeFileSystemAdapter(
  realPaths: Map<string, string>,
): Partial<fastGlob.FileSystemAdapter> {
  const isAncestorCycle = (directoryPath: string, realPath: string): boolean => {
    let currentPath = directoryPath
    let parentPath = path.dirname(currentPath)

    while (parentPath !== currentPath) {
      if (realPaths.get(parentPath) === realPath) {
        return true
      }

      currentPath = parentPath
      parentPath = path.dirname(currentPath)
    }

    return false
  }

  const readDirectory = (directoryPath: string, realPath: string): boolean => {
    const isCycle = isAncestorCycle(directoryPath, realPath)

    realPaths.set(directoryPath, realPath)

    return !isCycle
  }

  return {
    readdir: (directoryPath: string, optionsOrCallback: any, callback?: any) => {
      const options =
        typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const done = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

      fs.realpath(directoryPath, (realPathError, realPath) => {
        if (realPathError == null && !readDirectory(directoryPath, realPath)) {
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
        if (!readDirectory(directoryPath, fs.realpathSync(directoryPath))) {
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
    fs: createCycleSafeFileSystemAdapter(new Map<string, string>()),
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
