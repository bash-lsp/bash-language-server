import { Range } from 'vscode-languageserver/lib/main'
import { SyntaxNode } from 'web-tree-sitter'

export function forEach(node: SyntaxNode, cb: (n: SyntaxNode) => void) {
  cb(node)
  if (node.children.length) {
    node.children.forEach(n => forEach(n, cb))
  }
}

export function range(n: SyntaxNode): Range {
  return Range.create(
    n.startPosition.row,
    n.startPosition.column,
    n.endPosition.row,
    n.endPosition.column,
  )
}

export function isDefinition(n: SyntaxNode): boolean {
  switch (n.type) {
    // For now. Later we'll have a command_declaration take precedence over
    // variable_assignment
    case 'variable_assignment':
    case 'function_definition':
      return true
    default:
      return false
  }
}

export function isReference(n: SyntaxNode): boolean {
  switch (n.type) {
    case 'variable_name':
    case 'command_name':
      return true
    default:
      return false
  }
}

export function findParent(
  start: SyntaxNode,
  predicate: (n: SyntaxNode) => boolean,
): SyntaxNode | null {
  let node = start.parent
  while (node !== null) {
    if (predicate(node)) {
      return node
    }
    node = node.parent
  }
  return null
}
