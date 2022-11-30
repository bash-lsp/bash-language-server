const SHEBANG_REGEXP = /^#!(.*)/

// TODO: at some point we could let this return all known shells (like dash, ksh, etc)
// and make the call side decide what to support.
type SupportedBashDialect = 'bash' | 'sh'

export function getShebang(fileContent: string): string | null {
  const match = SHEBANG_REGEXP.exec(fileContent)
  if (!match || !match[1]) {
    return null
  }

  return match[1].trim()
}

export function getShellDialect(shebang: string): SupportedBashDialect | null {
  if (shebang.startsWith('/bin/sh') || shebang.startsWith('/usr/bin/env sh')) {
    return 'sh'
  }

  if (
    shebang.startsWith('/bin/bash') ||
    shebang.startsWith('/usr/bin/bash') ||
    shebang.startsWith('/usr/bin/env bash')
  ) {
    return 'bash'
  }

  return null
}

export function analyzeShebang(fileContent: string): {
  shellDialect: SupportedBashDialect | null
  shebang: string | null
} {
  const shebang = getShebang(fileContent)
  return {
    shebang,
    shellDialect: shebang ? getShellDialect(shebang) : null,
  }
}
