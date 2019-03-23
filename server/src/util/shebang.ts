const SHEBANG_REGEXP = /^#!(.*)/

export function hasBashShebang(fileContent: string) {
  const match = SHEBANG_REGEXP.exec(fileContent)
  if (!match || !match[1]) {
    return false
  }

  const shebang = match[1].replace('-', '').trim()
  return shebang.endsWith('bash') || shebang.endsWith('sh')
}
