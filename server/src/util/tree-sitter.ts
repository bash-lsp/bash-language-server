import { Range } from 'vscode-languageserver/lib/main'
import { Point, SyntaxNode } from 'web-tree-sitter'

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

/**
 * Given a tree and a point, try to find the named leaf node that the point corresponds to.
 * This is a helper for wordAtPoint, useful in cases where the point occurs at the boundary of
 * a word so the normal behavior of "namedDescendantForPosition" does not find the desired leaf.
 * For example, if you do
 * > (new Parser()).setLanguage(bash).parse("echo 42").rootNode.descendantForIndex(4).text
 * then you get 'echo 42', not the leaf node for 'echo'.
 *
 * TODO: the need for this function might reveal a flaw in tree-sitter-bash.
 */
export function namedLeafDescendantForPosition(
  point: Point,
  rootNode: SyntaxNode,
): SyntaxNode | null {
  const node = rootNode.namedDescendantForPosition(point)

  if (node.childCount === 0) {
    return node
  } else {
    // The node wasn't a leaf. Try to figure out what word we should use.
    const nodeToUse = searchForLeafNode(point, node)
    if (nodeToUse) {
      return nodeToUse
    } else {
      return null
    }
  }
}

function searchForLeafNode(point: Point, parent: SyntaxNode): SyntaxNode | null {
  let child: SyntaxNode = parent.firstNamedChild
  while (child) {
    if (
      pointsEqual(child.startPosition, point) ||
      pointsEqual(child.endPosition, point)
    ) {
      if (child.childCount === 0) {
        return child
      } else {
        return searchForLeafNode(point, child)
      }
    }

    child = child.nextNamedSibling
  }

  return null
}

function pointsEqual(point1: Point, point2: Point) {
  return point1.row === point2.row && point1.column === point2.column
}
