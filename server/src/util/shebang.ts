const SHEBANG_REGEXP = /^#!(.*)/

export function getShebang(fileContent: string): string | null {
  const match = SHEBANG_REGEXP.exec(fileContent)
  if (!match || !match[1]) {
    return null
  }

  return match[1].replace('-', '').trim()
}

export function isBashShebang(shebang: string): boolean {
  return shebang.endsWith('bash') || shebang.endsWith('sh')
}

export function hasBashShebang(fileContent: string): boolean {
  const shebang = getShebang(fileContent)
  return shebang ? isBashShebang(shebang) : false
}
