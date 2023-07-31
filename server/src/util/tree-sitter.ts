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

/**
 * Recursively iterates over all nodes, like forEach, but does it serially on
 * each level of the tree.
 */
export function serialForEach(nodes: SyntaxNode[], callback: (n: SyntaxNode) => boolean) {
  let toFollow: SyntaxNode[] = []

  for (const n of nodes) {
    if (callback(n)) {
      toFollow.push(n)
    }
  }

  toFollow = toFollow.reduce((children, n) => {
    for (const c of n.children) {
      children.push(c)
    }

    return children
  }, [] as typeof toFollow)

  if (toFollow.length) {
    serialForEach(toFollow, callback)
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
