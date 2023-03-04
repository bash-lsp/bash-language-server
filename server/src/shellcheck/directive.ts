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
