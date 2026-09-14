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
 * Only the directories that are symbolic links are checked: the walk can only
 * descend, so every cycle has to be entered through a symbolic link, and a
 * plain directory can never link back to an ancestor. Directories are listed
 * with `withFileTypes`, which is what `fast-glob` does on supported Node
 * versions, so the common case does not pay for a `realpath` call at all.
 */
function createCycleSafeFileSystemAdapter(): Partial<fastGlob.FileSystemAdapter> {
  // Symbolic links to directories, by normalized path.
  const symlinkedDirectories = new Set<string>()
  // Real paths of the directories that had to be checked, by normalized path.
  const realPaths = new Map<string, string>()
  // `readdir` without `withFileTypes` cannot report symbolic links, and from
  // that point on every directory has to be checked.
  let canDetectSymlinks = true

  const realPathOf = (directoryPath: string): string => {
    let realPath = realPaths.get(directoryPath)

    if (realPath === undefined) {
      try {
        // The native implementation resolves paths in a single system call,
        // which is considerably cheaper than the JavaScript fallback.
        realPath = fs.realpathSync.native(directoryPath)
      } catch {
        realPath = directoryPath
      }

      realPaths.set(directoryPath, realPath)
    }

    return realPath
  }

  const linksBackToAncestor = (directoryPath: string): boolean => {
    const realPath = realPathOf(directoryPath)
    let parentPath = path.dirname(directoryPath)

    while (parentPath !== directoryPath) {
      if (realPathOf(parentPath) === realPath) {
        return true
      }

      directoryPath = parentPath
      parentPath = path.dirname(directoryPath)
    }

    return false
  }

  const isCycle = (directoryPath: string): boolean => {
    const normalizedPath = path.normalize(directoryPath)

    if (canDetectSymlinks && !symlinkedDirectories.has(normalizedPath)) {
      return false
    }

    return linksBackToAncestor(normalizedPath)
  }

  const recordEntries = (directoryPath: string, entries: unknown): void => {
    if (!Array.isArray(entries)) {
      canDetectSymlinks = false
      return
    }

    for (const entry of entries) {
      if (typeof entry === 'string') {
        canDetectSymlinks = false
        return
      }

      const dirent = entry as fs.Dirent

      if (typeof dirent?.isSymbolicLink === 'function' && dirent.isSymbolicLink()) {
        symlinkedDirectories.add(path.normalize(path.join(directoryPath, dirent.name)))
      }
    }
  }

  return {
    readdir: (directoryPath: string, optionsOrCallback: any, callback?: any) => {
      const options =
        typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const done = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

      if (isCycle(directoryPath)) {
        done(null, [])
        return
      }

      const onRead = (error: NodeJS.ErrnoException | null, entries: unknown) => {
        if (error != null) {
          done(error)
          return
        }

        recordEntries(directoryPath, entries)
        done(null, entries)
      }

      if (options == null) {
        fs.readdir(directoryPath, onRead)
      } else {
        fs.readdir(directoryPath, options, onRead)
      }
    },
    readdirSync: (directoryPath: string, options?: any) => {
      if (isCycle(directoryPath)) {
        return []
      }

      const entries =
        options == null
          ? fs.readdirSync(directoryPath)
          : fs.readdirSync(directoryPath, options)

      recordEntries(directoryPath, entries)

      return entries
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
    fs: createCycleSafeFileSystemAdapter(),
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
