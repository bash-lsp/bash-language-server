const SHEBANG_REGEXP = /^#!(.*)/
const SHELL_REGEXP = /bin[/](?:env )?(\w+)/

const BASH_DIALECTS = ['sh', 'bash', 'dash', 'ksh'] as const
type SupportedBashDialect = typeof BASH_DIALECTS[number]

export function getShebang(fileContent: string): string | null {
  const match = SHEBANG_REGEXP.exec(fileContent)
  if (!match || !match[1]) {
    return null
  }

  return match[1].trim()
}

export function getShellDialect(shebang: string): SupportedBashDialect | null {
  const match = SHELL_REGEXP.exec(shebang)
  if (match && match[1]) {
    const bashDialect = match[1].trim() as any
    if (BASH_DIALECTS.includes(bashDialect)) {
      return bashDialect
    }
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
