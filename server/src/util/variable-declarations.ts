import { Node as SyntaxNode } from 'web-tree-sitter'

import * as TreeSitterUtil from './tree-sitter'

/** A static declaration, shared by completion and declaration lookup. */
export type VariableDeclaration = {
  name: string
  node: SyntaxNode
  scope: SyntaxNode
  availableFrom: number
}

export function getLocalVariableDeclarations(command: SyntaxNode): VariableDeclaration[] {
  const scope = TreeSitterUtil.findParentOfType(command, 'function_definition')
  if (
    !scope ||
    command.type !== 'declaration_command' ||
    !['local', 'declare', 'typeset'].includes(command.firstChild?.text ?? '')
  ) {
    return []
  }

  const declarations: VariableDeclaration[] = []
  let parsingOptions = true
  for (const argument of command.namedChildren) {
    let name =
      argument.type === 'variable_name' ? argument : argument.childForFieldName('name')
    if (name?.type === 'subscript') name = name.childForFieldName('name')

    if (parsingOptions) {
      const option = TreeSitterUtil.resolveStaticString(argument)
      if (option === '--') {
        parsingOptions = false
        continue
      }
      if (option && /^[-+]./.test(option)) {
        // Only known declaring modes can establish locality. -g is global;
        // print/function modes and unsupported options do not declare a local.
        if (!/^[-+][aAgiIlnrtux]+$/.test(option) || /^-.*g/.test(option)) return []
        continue
      }
      // An unresolved leading word might expand to an option such as -g.
      if (!name) return []
      parsingOptions = false
    }
    if (name?.type === 'variable_name') {
      declarations.push({
        name: name.text,
        node: name,
        scope,
        availableFrom: command.endIndex,
      })
    }
  }
  return declarations
}

/**
 * Only unconditional statements directly in the function body prove locality.
 * Conditional declarations, pipelines and runtime shell options remain unknown.
 */
export function getUnconditionalLocals(body: SyntaxNode): Map<string, number> {
  const locals = new Map<string, number>()
  for (const statement of body.namedChildren) {
    if (statement.nextSibling?.type === '&') continue
    for (const declaration of getLocalVariableDeclarations(statement)) {
      if (!locals.has(declaration.name)) {
        locals.set(declaration.name, declaration.availableFrom)
      }
    }
  }
  return locals
}
