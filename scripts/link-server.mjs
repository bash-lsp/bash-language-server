import { mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// The wrapper's Connection types must match the server it loads.
const links = {
  'bash-language-server': 'server',
  'vscode-languageserver': 'server/node_modules/vscode-languageserver',
}

for (const [name, target] of Object.entries(links)) {
  const linkPath = resolve('vscode-client/node_modules', name)
  mkdirSync(dirname(linkPath), { recursive: true })
  rmSync(linkPath, { recursive: true, force: true })
  symlinkSync(resolve(target), linkPath, process.platform === 'win32' ? 'junction' : 'dir')
}
