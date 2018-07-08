import { execFile } from 'child_process'
import * as Path from 'path'
import { workspace } from 'vscode'

function isWindows() {
  return process.platform === 'win32'
}

function getBasePath(): Promise<string> {
  return new Promise((resolve, reject) => {
    const npmBin = isWindows() ? 'npm.cmd' : 'npm'
    execFile(npmBin, ['bin', '-g'], (err, stdout) => {
      if (err) {
        reject(err)
      }
      const basePath = stdout.replace(/(\n|\r)+$/, '').trim()
      resolve(basePath)
    })
  })
}

type ServerInfo = { command: string; version: string }

export async function getServerInfo(): Promise<ServerInfo> {
  let command: string = workspace.getConfiguration('bashIde').get('path') || ''
  if (!command) {
    const basePath = await getBasePath()
    const name = isWindows() ? 'bash-language-server.cmd' : 'bash-language-server'
    command = Path.join(basePath, name)
  }

  return new Promise<ServerInfo>((resolve, reject) => {
    execFile(command, ['-v'], (err, stdout) => {
      if (err) {
        reject(err)
      }
      const versionMatch = stdout.match(/\d+[.]\d+[.]\d+/)
      const version = (versionMatch && versionMatch[0]) || '0.0.0'
      resolve({ command, version })
    })
  })
}
