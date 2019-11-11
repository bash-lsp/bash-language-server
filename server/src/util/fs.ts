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

// from https://github.com/sindresorhus/untildify/blob/master/index.js#L11
export function untildify(pathWithTilde: string): string {
  const homeDirectory = Os.homedir()
  return homeDirectory
    ? pathWithTilde.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathWithTilde
}
