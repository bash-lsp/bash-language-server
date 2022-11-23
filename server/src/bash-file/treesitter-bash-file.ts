import * as LSP from 'vscode-languageserver'
import { Range } from 'vscode-languageserver/lib/main'
import * as Parser from 'web-tree-sitter'
import { SyntaxNode } from 'web-tree-sitter'

import { BaseBashFile, Declarations, Kinds } from './types'

const treeSitterTypeToLSPKind: Kinds = {
  // These keys are using underscores as that's the naming convention in tree-sitter.
  environment_variable_assignment: LSP.SymbolKind.Variable,
  function_definition: LSP.SymbolKind.Function,
  variable_assignment: LSP.SymbolKind.Variable,
}

function forEach(node: SyntaxNode, cb: (n: SyntaxNode) => void) {
  cb(node)
  if (node.children.length) {
    node.children.forEach((n) => forEach(n, cb))
  }
}

function createRange(n: SyntaxNode): Range {
  return Range.create(
    n.startPosition.row,
    n.startPosition.column,
    n.endPosition.row,
    n.endPosition.column,
  )
}

function isDefinition(n: SyntaxNode): boolean {
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

function isReference(n: SyntaxNode): boolean {
  switch (n.type) {
    case 'variable_name':
    case 'command_name':
      return true
    default:
      return false
  }
}

function findParent(
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
 * The Analyzer uses the Abstract Syntax Trees (ASTs) that are provided by
 * tree-sitter to find definitions, reference, etc.
 */
export class BashFile implements BaseBashFile {
  private ast: Parser.Tree
  public problems: LSP.Diagnostic[]
  private contents: string
  public declarations: Declarations

  public constructor(
    ast: Parser.Tree,
    problems: LSP.Diagnostic[],
    contents: string,
    declarations: Declarations,
  ) {
    this.ast = ast
    this.problems = problems
    this.contents = contents
    this.declarations = declarations
  }

  public static parse({
    uri,
    contents,
    parser,
  }: {
    uri: string
    contents: string
    parser: Parser
  }): BashFile {
    const tree = parser.parse(contents)

    const problems: LSP.Diagnostic[] = []
    const declarations: Declarations = {}

    forEach(tree.rootNode, (n: Parser.SyntaxNode) => {
      if (n.type === 'ERROR') {
        problems.push(
          LSP.Diagnostic.create(
            createRange(n),
            'Failed to parse expression',
            LSP.DiagnosticSeverity.Error,
          ),
        )
        return
      } else if (isDefinition(n)) {
        const named = n.firstNamedChild

        if (named === null) {
          return
        }

        const name = contents.slice(named.startIndex, named.endIndex)
        const namedDeclarations = declarations[name] || []

        const parent = findParent(n, (p) => p.type === 'function_definition')
        const parentName =
          parent && parent.firstNamedChild
            ? contents.slice(
                parent.firstNamedChild.startIndex,
                parent.firstNamedChild.endIndex,
              )
            : '' // TODO: unsure what we should do here?

        namedDeclarations.push(
          LSP.SymbolInformation.create(
            name,
            treeSitterTypeToLSPKind[n.type],
            createRange(n),
            uri,
            parentName,
          ),
        )
        declarations[name] = namedDeclarations
      }
    })

    function findMissingNodes(node: Parser.SyntaxNode) {
      if (node.isMissing()) {
        problems.push(
          LSP.Diagnostic.create(
            createRange(node),
            `Syntax error: expected "${node.type}" somewhere in the file`,
            LSP.DiagnosticSeverity.Warning,
          ),
        )
      } else if (node.hasError()) {
        node.children.forEach(findMissingNodes)
      }
    }

    findMissingNodes(tree.rootNode)

    return new BashFile(tree, problems, contents, declarations)
  }

  /**
   * Find all occurrences of name in the given file.
   * It's currently not scope-aware.
   */
  public findOccurrences(uri: string, query: string): LSP.Location[] {
    const { ast: tree, contents } = this

    const locations: LSP.Location[] = []

    forEach(tree.rootNode, (n) => {
      let name: null | string = null
      let range: null | LSP.Range = null

      if (isReference(n)) {
        const node = n.firstNamedChild || n
        name = contents.slice(node.startIndex, node.endIndex)
        range = createRange(node)
      } else if (isDefinition(n)) {
        const namedNode = n.firstNamedChild
        if (namedNode) {
          name = contents.slice(namedNode.startIndex, namedNode.endIndex)
          range = createRange(namedNode)
        }
      }

      if (name === query && range !== null) {
        locations.push(LSP.Location.create(uri, range))
      }
    })

    return locations
  }

  /**
   * Find the node at the given point.
   *
   * TODO: should be private as it exposes the syntax node
   */
  public nodeAtPoint(line: number, column: number): Parser.SyntaxNode | null {
    const document = this.ast

    if (!document?.rootNode) {
      // Check for lacking rootNode (due to failed parse?)
      return null
    }

    return document.rootNode.descendantForPosition({ row: line, column })
  }

  /**
   * Find the full word at the given point.
   */
  public wordAtPoint(line: number, column: number): string | null {
    const node = this.nodeAtPoint(line, column)

    if (!node || node.childCount > 0 || node.text.trim() === '') {
      return null
    }

    return node.text.trim()
  }

  /**
   * Find the name of the command at the given point.
   */
  public commandNameAtPoint(line: number, column: number): string | null {
    let node = this.nodeAtPoint(line, column)

    while (node && node.type !== 'command') {
      node = node.parent
    }

    if (!node) {
      return null
    }

    const firstChild = node.firstNamedChild

    if (!firstChild || firstChild.type !== 'command_name') {
      return null
    }

    return firstChild.text.trim()
  }
}
