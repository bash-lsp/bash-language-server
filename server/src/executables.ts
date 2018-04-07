import * as Fs from 'fs'
import * as Path from 'path'

import * as ArrayUtil from './util/array'
import * as FsUtil from './util/fs'
import * as ShUtil from './util/sh'

/**
 * Provides information based on the programs on your PATH
 */
export default class Executables {
  /**
   * @param path is expected to to be a ':' separated list of paths.
   */
  public static fromPath(path: string): Promise<Executables> {
    const paths = path.split(':')
    const promises = paths.map(x => findExecutablesInPath(x))
    return Promise.all(promises)
      .then(ArrayUtil.flatten)
      .then(ArrayUtil.uniq)
      .then(executables => new Executables(executables))
  }

  private executables: Set<string>

  private constructor(executables: string[]) {
    this.executables = new Set(executables)
  }

  /**
   * Find all programs in your PATH
   */
  public list(): Array<string> {
    return Array.from(this.executables.values())
  }

  /**
   * Check if the the given {{executable}} exists on the PATH
   */
  public isExecutableOnPATH(executable: string): boolean {
    return this.executables.has(executable)
  }

  /**
   * Look up documentation for the given executable.
   *
   * For now it simply tries to look up the MAN documentation.
   */
  public documentation(executable: string): Promise<string> {
    return ShUtil.execShellScript(`man ${executable} | col -b`).then(doc => {
      return !doc
        ? Promise.resolve(`No MAN page for ${executable}`)
        : Promise.resolve(doc)
    })
  }
}

/**
 * Only returns direct children, or the path itself if it's an executable.
 */
function findExecutablesInPath(path: string): Promise<string[]> {
  return new Promise((resolve, _) => {
    Fs.lstat(path, (err, stat) => {
      if (err) {
        resolve([])
      } else {
        if (stat.isDirectory()) {
          Fs.readdir(path, (readDirErr, paths) => {
            if (readDirErr) {
              resolve([])
            } else {
              const files = paths.map(p =>
                FsUtil.getStats(Path.join(path, p))
                  .then(s => (s.isFile() ? [Path.basename(p)] : []))
                  .catch(() => []),
              )

              resolve(Promise.all(files).then(ArrayUtil.flatten))
            }
          })
        } else if (stat.isFile()) {
          resolve([Path.basename(path)])
        } else {
          // Something else.
          resolve([])
        }
      }
    })
  })
}
