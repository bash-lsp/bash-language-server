const SHEBANG_REGEXP = /^#!(.*)/

export function getShebang(fileContent: string): string | null {
  const match = SHEBANG_REGEXP.exec(fileContent)
  if (!match || !match[1]) {
    return null
  }

  return match[1].trim()
}

/**
 * Check if the given shebang is a bash shebang.
 */
export function isBashShebang(shebang: string): boolean {
  return (
    shebang.startsWith('/bin/bash') ||
    shebang.startsWith('/bin/sh') ||
    shebang.startsWith('/usr/bin/bash') ||
    shebang.startsWith('/usr/bin/env bash') ||
    shebang.startsWith('/usr/bin/env sh')
  )
}

export function hasBashShebang(fileContent: string): boolean {
  const shebang = getShebang(fileContent)
  return shebang ? isBashShebang(shebang) : false
}
