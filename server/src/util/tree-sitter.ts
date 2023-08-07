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
 * Iterates over all nodes in a tree like forEach but uses a breadth-first
 * approach with loops and gives `callback` more control over what nodes to go
 * over.
 *
 * ```
 *                          o
 *               ┌──────────┬──────────┐
 *             [ o          o          o ]
 *   ┌─────┬─────┐       ┌─────┐       ┌─────┬─────┬─────┐
 * [ o     o     o ]   [ o     o ]   [ o     o     o     o ]
 * ```
 *
 * Each `o` is a node. Each node may have children that can be followed. The
 * first `o` represents `node` whose children are automatically followed.
 * Returning `{ followChildren: false }` from `callback` prevents a node's
 * children from being followed. Nodes between `[` and `]` are grouped together
 * into blocks. Returning `{ stopBlock: true }` from `callback` stops the
 * iteration of the current block and goes on to the next block to iterate over.
 */
export function breadthForEach(
  node: SyntaxNode,
  callback: (n: SyntaxNode) => { followChildren?: boolean; stopBlock?: boolean },
) {
  let nodesChildren: SyntaxNode[][] = []
  nodesChildren.push(node.children)

  while (nodesChildren.length) {
    const nc: SyntaxNode[][] = []

    for (const children of nodesChildren) {
      for (const child of children) {
        const { followChildren = true, stopBlock = false } = callback(child)

        if (followChildren && child.children.length) {
          nc.push(child.children)
        }

        if (stopBlock) {
          break
        }
      }
    }

    nodesChildren = nc
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

export function findParentOfType(start: SyntaxNode, type: string) {
  return findParent(start, (n) => n.type === type)
}
