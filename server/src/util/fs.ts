import * as Fs from 'fs'
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
