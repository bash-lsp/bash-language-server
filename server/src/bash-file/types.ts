import * as LSP from 'vscode-languageserver'

export type Kinds = { [type: string]: LSP.SymbolKind }

export type Declarations = { [name: string]: LSP.SymbolInformation[] }

export interface BaseBashFile {
  problems: LSP.Diagnostic[]
  declarations: Declarations

  /**
   * Find all occurrences of name in the given file.
   * It's currently not scope-aware.
   */
  findOccurrences(uri: string, query: string): LSP.Location[]

  /**
   * Find the node at the given point.
   *
   * TODO: should be private as it exposes the syntax node
   */
  nodeAtPoint(line: number, column: number): any | null

  /**
   * Find the full word at the given point.
   */
  wordAtPoint(line: number, column: number): string | null

  /**
   * Find the name of the command at the given point.
   */
  commandNameAtPoint(line: number, column: number): string | null
}
