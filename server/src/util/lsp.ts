import * as LSP from 'vscode-languageserver/node'

/**
 * Determine if a position is included in a range.
 */
export function isPositionIncludedInRange(position: LSP.Position, range: LSP.Range) {
  return (
    range.start.line <= position.line &&
    range.end.line >= position.line &&
    range.start.character <= position.character &&
    range.end.character >= position.character
  )
}
