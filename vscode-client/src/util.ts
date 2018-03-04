import * as Process from 'child_process';
import * as Path from 'path';

/**
 *
 */
export function base(): Promise<string> {
  return new Promise((resolve, reject) => {
    Process.execFile('npm', ['bin', '-g'], (err, stdout) => {
      if (err) {
        reject(err)
      }
      const base = stdout.replace(/(\n|\r)+$/, '').trim()
      resolve(base)
    })
  })
}

export function executable(base: string): Promise<string> {
  const command = Path.join(base, 'bash-language-server')
  return new Promise((resolve, reject) => {
    // Simply check if the bash-language-server is installed.
    Process.execFile(command, ['-v'], (err) => {
      if (err) {
        reject(err)
      }
      resolve(command)
    })
  })


}
