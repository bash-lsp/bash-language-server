import * as ShUtil from './util/sh'

// You can generate this list by running `compgen -b` in a bash session
export const LIST = [
  '.',
  ':',
  '[',
  'alias',
  'bg',
  'bind',
  'break',
  'builtin',
  'caller',
  'cd',
  'command',
  'compgen',
  'compopt',
  'complete',
  'continue',
  'declare',
  'dirs',
  'disown',
  'echo',
  'enable',
  'eval',
  'exec',
  'exit',
  'export',
  'false',
  'fc',
  'fg',
  'getopts',
  'hash',
  'help',
  'history',
  'jobs',
  'kill',
  'let',
  'local',
  'logout',
  'popd',
  'printf',
  'pushd',
  'pwd',
  'read',
  'readonly',
  'return',
  'set',
  'shift',
  'shopt',
  'source',
  'suspend',
  'test',
  'times',
  'trap',
  'true',
  'type',
  'typeset',
  'ulimit',
  'umask',
  'unalias',
  'unset',
  'wait',
]

export function isBuiltin(word: string): boolean {
  return LIST.find(builtin => builtin === word) !== undefined
}

export async function documentation(builtin: string): Promise<string> {
  const errorMessage = `No help page for ${builtin}`
  try {
    const doc = await ShUtil.execShellScript(`help ${builtin}`)
    return doc || errorMessage
  } catch (error) {
    return errorMessage
  }
}
