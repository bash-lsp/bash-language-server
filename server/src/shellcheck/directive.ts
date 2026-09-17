const DIRECTIVE_TYPES = ['enable', 'disable', 'source', 'source-path', 'shell'] as const
type DirectiveType = (typeof DIRECTIVE_TYPES)[number]

type Directive =
  | {
      type: 'enable'
      rules: string[]
    }
  | {
      type: 'disable'
      rules: string[]
    }
  | {
      type: 'source'
      path: string
    }
  | {
      type: 'source-path'
      path: string
    }
  | {
      type: 'shell'
      shell: string
    }

const DIRECTIVE_REG_EXP = /^(#\s*shellcheck\s+)([^#]*)/

export function parseShellCheckDirective(line: string): Directive[] {
  const match = line.match(DIRECTIVE_REG_EXP)

  if (!match) {
    return []
  }

  const commands = match[2]
    .split(' ')
    .map((command) => command.trim())
    .filter((command) => command !== '')

  const directives: Directive[] = []

  for (const command of commands) {
    const [typeKey, directiveValue] = command.split('=')
    const type = DIRECTIVE_TYPES.includes(typeKey as any)
      ? (typeKey as DirectiveType)
      : null

    if (!type || !directiveValue) {
      continue
    }

    if (type === 'source-path' || type === 'source') {
      directives.push({
        type,
        path: directiveValue,
      })
    } else if (type === 'shell') {
      directives.push({
        type,
        shell: directiveValue,
      })
      continue
    } else if (type === 'enable' || type === 'disable') {
      const rules = []

      for (const arg of directiveValue.split(',')) {
        const ruleRangeMatch = arg.match(/^SC(\d*)-SC(\d*)$/)
        if (ruleRangeMatch) {
          for (
            let i = parseInt(ruleRangeMatch[1], 10);
            i <= parseInt(ruleRangeMatch[2], 10);
            i++
          ) {
            rules.push(`SC${i}`)
          }
        } else {
          arg
            .split(',')
            .map((arg) => arg.trim())
            .filter((arg) => arg !== '')
            .forEach((arg) => rules.push(arg))
        }
      }

      directives.push({
        type,
        rules,
      })
    }
  }

  return directives
}

/** Extend a disable list without rewriting other directives or explanatory comments. */
export function addDisabledRule(line: string, code: string): string | null {
  const prefix = line.match(/^[ \t]*#[ \t]*shellcheck[ \t]+/)
  if (!prefix || line.endsWith('\\')) return null

  // Treat quoted values as a single token, including paths containing spaces or #.
  const tokens = line
    .slice(prefix[0].length)
    .matchAll(/(?:[^\s"'#]+|"[^"]*"|'[^']*')+|#.*/g)
  for (const token of tokens) {
    if (token[0].startsWith('#')) break
    const match = token[0].match(/^disable=(.+)$/)
    if (!match) continue
    const values = match[1].split(',')
    if (
      !values.every((value) => /^(?:(?:SC)?\d{4}(?:-(?:SC)?\d{4})?|all)$/.test(value))
    ) {
      continue
    }
    const numericCode = Number(code.slice(2))
    const covered = values.some((value) => {
      if (value === 'all') return true
      const [start, end] = value.replace(/SC/g, '').split('-')
      // Single codes preserve their spelling; ranges contain canonical numeric codes.
      return end === undefined
        ? `SC${start}` === code
        : code === `SC${numericCode}` &&
            Number(start) <= numericCode &&
            numericCode <= Number(end)
    })
    if (covered) return line

    values.push(code)
    values.sort(
      (a, b) =>
        Number(a.replace(/^SC/, '').split('-')[0]) -
        Number(b.replace(/^SC/, '').split('-')[0]),
    )
    const start = prefix[0].length + token.index! + 'disable='.length
    return line.slice(0, start) + values.join(',') + line.slice(start + match[1].length)
  }
  return null
}
