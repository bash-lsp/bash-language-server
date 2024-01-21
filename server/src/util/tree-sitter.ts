import * as LSP from 'vscode-languageserver/node'
import { SyntaxNode } from 'web-tree-sitter'

/**
 * Recursively iterate over all nodes in a tree.
 *
 * @param node The node to start iterating from
 * @param callback The callback to call for each node. Return false to stop following children.
 */
export function forEach(node: SyntaxNode, callback: (n: SyntaxNode) => void | boolean) {
  const followChildren = callback(node) !== false
  if (followChildren && node.children.length) {
    node.children.forEach((n) => forEach(n, callback))
  }
}

export function range(n: SyntaxNode): LSP.Range {
  return LSP.Range.create(
    n.startPosition.row,
    n.startPosition.column,
    n.endPosition.row,
    n.endPosition.column,
  )
}

export function isDefinition(n: SyntaxNode): boolean {
  switch (n.type) {
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

export function isVariableInReadCommand(n: SyntaxNode): boolean {
  if (
    n.type === 'word' &&
    n.parent?.type === 'command' &&
    n.parent.firstChild?.text === 'read' &&
    !n.text.startsWith('-') &&
    !/^-.*[dinNptu]$/.test(n.previousSibling?.text ?? '')
  ) {
    return true
  }

  return false
}

export function isExpansion(n: SyntaxNode): boolean {
  switch (n.type) {
    case 'expansion':
    case 'simple_expansion':
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

export function findParentOfType(start: SyntaxNode, type: string | string[]) {
  if (typeof type === 'string') {
    return findParent(start, (n) => n.type === type)
  }

  return findParent(start, (n) => type.includes(n.type))
}

/**
 * Resolves the full string value of a node
 * Returns null if the value can't be statically determined (ie, it contains a variable or command substition).
 * Supports: word, string, raw_string, and concatenation
 */
export function resolveStaticString(node: SyntaxNode): string | null {
  if (node.type === 'concatenation') {
    const values = []
    for (const child of node.namedChildren) {
      const value = resolveStaticString(child)
      if (value === null) return null
      values.push(value)
    }
    return values.join('')
  }
  if (node.type === 'word') return node.text
  if (node.type === 'string' || node.type === 'raw_string') {
    if (node.namedChildCount === 0) return node.text.slice(1, -1)
    const children = node.namedChildren
    if (children.length === 1 && children[0].type === 'string_content')
      return children[0].text
    return null
  }
  return null
}
