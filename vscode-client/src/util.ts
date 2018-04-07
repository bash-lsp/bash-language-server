import { execFile } from 'child_process'
import * as path from 'path'

function isWindows() {
  return process.platform === 'win32'
}

function getBasePath(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('npm', ['bin', '-g'], (err, stdout) => {
      if (err) {
        reject(err)
      }
      const basePath = stdout.replace(/(\n|\r)+$/, '').trim()
      resolve(basePath)
    })
  })
}

export async function getServerCommand(): Promise<string> {
  const basePath = await getBasePath()
  const name = isWindows() ? 'bash-language-server.cmd' : 'bash-language-server'
  const command = path.join(basePath, name)

  return new Promise<string>((resolve, reject) => {
    // Simply check if the bash-language-server is installed.
    execFile(command, ['-v'], err => {
      if (err) {
        reject(err)
      }
      resolve(command)
    })
  })
}
