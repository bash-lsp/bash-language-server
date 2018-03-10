import * as Fs from 'fs'

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
