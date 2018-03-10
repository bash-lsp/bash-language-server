// tslint:disable:no-submodule-imports

import { ASTNode } from 'tree-sitter'
import { Range } from 'vscode-languageserver/lib/main'

export function forEach(node: ASTNode, cb: (n: ASTNode) => void) {
  cb(node)
  if (node.children.length) {
    node.children.forEach(n => forEach(n, cb))
  }
}

export function range(n: ASTNode): Range {
  return Range.create(
    n.startPosition.row,
    n.startPosition.column,
    n.endPosition.row,
    n.endPosition.column,
  )
}

export function isDefinition(n: ASTNode): boolean {
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

export function isReference(n: ASTNode): boolean {
  switch (n.type) {
    case 'variable_name':
    case 'command_name':
      return true
    default:
      return false
  }
}
