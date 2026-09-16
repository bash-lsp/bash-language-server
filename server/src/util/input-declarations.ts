import * as LSP from 'vscode-languageserver/node'
import { Node as SyntaxNode } from 'web-tree-sitter'

import * as TreeSitterUtil from './tree-sitter'
import { VariableDeclaration } from './variable-declarations'

type InputDeclaration = VariableDeclaration & { range: LSP.Range }

/** Literal destinations only: no implicit REPLY/MAPFILE or runtime word expansion. */
export function getInputVariableDeclarations(command: SyntaxNode): InputDeclaration[] {
  const builtin = command.childForFieldName('name')?.text
  if (
    command.type !== 'command' ||
    !['read', 'readarray', 'mapfile'].includes(builtin ?? '')
  )
    return []
  // Do not invent declarations in execution contexts the lexical scope engine
  // cannot distinguish (in particular, separate pipeline stages).
  if (
    command.nextSibling?.type === '&' ||
    TreeSitterUtil.findParent(
      command,
      (parent) =>
        ['pipeline', 'command_substitution', 'process_substitution'].includes(
          parent.type,
        ) || parent.nextSibling?.type === '&',
    )
  )
    return []
  const isRead = builtin === 'read'
  const arguments_ = command.childrenForFieldName('argument')
  const flags = isRead ? 'ersE' : 't'
  const optionsWithValues = isRead ? 'adinNptu' : 'dnOscuC'
  const scope = TreeSitterUtil.findParentOfType(command, [
    'function_definition',
    'subshell',
    'program',
  ])!
  const declarations: InputDeclaration[] = []
  let array: InputDeclaration | null | undefined
  let options = true

  function destination(node: SyntaxNode, offset = 0): InputDeclaration | null {
    const value = TreeSitterUtil.resolveStaticString(node)
    const name = value?.slice(offset)
    if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return null
    // Restrict edits to a literal token (possibly wholly quoted), not concatenations.
    const quote = ['string', 'raw_string'].includes(node.type) ? 1 : 0
    if (
      !['word', 'string', 'raw_string'].includes(node.type) ||
      node.text.slice(quote, quote ? -1 : undefined) !== value
    )
      return null
    const start = node.startPosition.column + quote + offset
    return {
      name,
      node,
      scope,
      availableFrom: command.endIndex,
      range: LSP.Range.create(
        node.startPosition.row,
        start,
        node.startPosition.row,
        start + name.length,
      ),
    }
  }

  for (let i = 0; i < arguments_.length; i++) {
    const argument = arguments_[i]
    const value = TreeSitterUtil.resolveStaticString(argument)
    if (options) {
      if (value === null) return [] // An expansion might change the option layout.
      if (value === '--') {
        options = false
        continue
      }
      if (value.startsWith('-') && value.length > 1) {
        for (let j = 1; j < value.length; j++) {
          const option = value[j]
          if (flags.includes(option)) continue
          if (!optionsWithValues.includes(option)) return []
          const attached = j + 1 < value.length
          const operand = attached ? argument : arguments_[++i]
          if (
            !operand ||
            (operand.type !== 'number' &&
              TreeSitterUtil.resolveStaticString(operand) === null)
          )
            return []
          if (option === 'a' && isRead) array = destination(operand, attached ? j + 1 : 0)
          break
        }
        continue
      }
      options = false
    }
    if (array !== undefined) continue // read -a ignores positional destinations.
    const declaration = destination(argument)
    if (!declaration) break
    declarations.push(declaration)
    if (!isRead) break // mapfile/readarray have one array destination.
  }
  return array === undefined ? declarations : array ? [array] : []
}

export function getInputVariableDeclaration(
  node: SyntaxNode,
): InputDeclaration | undefined {
  if (node.parent?.type !== 'command') return undefined
  return getInputVariableDeclarations(node.parent).find((declaration) =>
    declaration.node.equals(node),
  )
}

export function variableNameRange(node: SyntaxNode): LSP.Range {
  return getInputVariableDeclaration(node)?.range ?? TreeSitterUtil.range(node)
}
