import { mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const linkPath = resolve('vscode-client/node_modules/bash-language-server')

mkdirSync(dirname(linkPath), { recursive: true })
rmSync(linkPath, { recursive: true, force: true })
symlinkSync(
  resolve('server'),
  linkPath,
  process.platform === 'win32' ? 'junction' : 'dir',
)
