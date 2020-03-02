import * as Fs from 'fs'
import * as glob from 'glob'
import * as Os from 'os'

export function getStats(path: string): Promise<Fs.Stats> {
  return new Promise((resolve, reject) => {
    Fs.lstat(path, (err, stat) => {
      if (err) {
        reject(err)
      } else {
        resolve(stat)
      }
    })
  })
}

// from https://github.com/sindresorhus/untildify/blob/f85a087418aeaa2beb56fe2684fe3b64fc8c588d/index.js#L11
export function untildify(pathWithTilde: string): string {
  const homeDirectory = Os.homedir()
  return homeDirectory
    ? pathWithTilde.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathWithTilde
}

export async function getFilePaths({
  globPattern,
  rootPath,
}: {
  globPattern: string
  rootPath: string
}): Promise<string[]> {
  return new Promise((resolve, reject) => {
    glob(globPattern, { cwd: rootPath, nodir: true, absolute: true }, function(
      err,
      files,
    ) {
      if (err) {
        return reject(err)
      }

      resolve(files)
    })
  })
}
