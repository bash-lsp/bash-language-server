import type { File as FileNode, Node as SyntaxNode } from 'mvdan-sh'
import * as LSP from 'vscode-languageserver'
import { Range } from 'vscode-languageserver/lib/main'

const ShellScript = require('mvdan-sh') // NOTE: import is not working
const _parser = ShellScript.syntax.NewParser()

import { BaseBashFile, Declarations, Kinds } from './types'

const syntaxNodeTypeToLSPKind: Kinds = {
  FuncDecl: LSP.SymbolKind.Function,
  Assign: LSP.SymbolKind.Variable,
}

function createRange(node: SyntaxNode): Range {
  return Range.create(
    node.Pos().Line() - 1,
    node.Pos().Col() - 1,
    node.End().Line() - 1,
    node.End().Col() - 1,
  )
}

interface ValueNode extends SyntaxNode {
  Value: string
}

interface NamedNode extends SyntaxNode {
  Name: ValueNode
}

function isDefinition(node: SyntaxNode): node is NamedNode {
  switch (ShellScript.syntax.NodeType(node)) {
    // TODO: other cases?
    case 'Assign':
      return (node as any).Name !== null
    case 'FuncDecl':
      return true
    default:
      return false
  }
}

/*
function traverseParsed(node: Sh.ParsedSh, act: (node: Sh.ParsedSh) => void) {
  act(node)
  getChildren(node).forEach((child) => traverseParsed(child, act))
}

function withParents<T extends Sh.ParsedSh>(root: T) {
  traverseParsed(root, (node) => {
    getChildren(node).forEach((child) => ((child as Sh.BaseNode).parent = node))
  })
  return root
}
*/

/**
 * The Analyzer uses the Abstract Syntax Trees (ASTs) that are provided by
 * tree-sitter to find definitions, reference, etc.
 */
export class BashFile implements BaseBashFile {
  private fileNode: FileNode
  public problems: LSP.Diagnostic[]
  private contents: string
  public declarations: Declarations

  public constructor(
    fileNode: FileNode,
    problems: LSP.Diagnostic[],
    contents: string,
    declarations: Declarations,
  ) {
    this.fileNode = fileNode
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
    parser: any
  }): BashFile {
    const fileNode = _parser.Parse(contents)

    const problems: LSP.Diagnostic[] = []
    const declarations: Declarations = {}

    // TODO: handle errros

    //ShellScript.syntax.DebugPrint(fileNode)

    ShellScript.syntax.Walk(fileNode, (node: SyntaxNode) => {
      if (!node) {
        return true
      }

      if (isDefinition(node)) {
        const name = node.Name.Value
        const namedDeclarations = declarations[name] || []

        /*
        const parent = findParent(n, (p) => p.type === 'function_definition')
        const parentName =
          parent && parent.firstNamedChild
            ? contents.slice(
                parent.firstNamedChild.startIndex,
                parent.firstNamedChild.endIndex,
              )
            : '' // TODO: unsure what we should do here?
        */

        // TODO: parent?
        const containerName = undefined

        namedDeclarations.push(
          LSP.SymbolInformation.create(
            name,
            syntaxNodeTypeToLSPKind[ShellScript.syntax.NodeType(node)],
            createRange(node),
            uri,
            containerName,
          ),
        )
        declarations[name] = namedDeclarations
      }

      return true
    })

    return new BashFile(fileNode, problems, contents, declarations)
  }

  /**
   * Find all occurrences of name in the given file.
   * It's currently not scope-aware.
   */
  public findOccurrences(uri: string, query: string): LSP.Location[] {
    const locations: LSP.Location[] = []

    ShellScript.syntax.Walk(this.fileNode, (node: SyntaxNode) => {
      if (!node) {
        return true
      }

      let relevantNode: ValueNode | undefined

      if (isDefinition(node)) {
        relevantNode = node.Name
      } else if (ShellScript.syntax.NodeType(node) === 'ParamExp') {
        relevantNode = (node as any).Param
      }

      if (relevantNode?.Value === query) {
        const range = createRange(relevantNode)
        locations.push(LSP.Location.create(uri, range))
      }

      return true
    })

    return locations
  }

  /**
   * Find the node at the given point.
   *
   * TODO: should be private as it exposes the syntax node
   */
  public nodeAtPoint(line: number, column: number): SyntaxNode | null {
    throw new Error('not implemented')
    // return document.rootNode.descendantForPosition({ row: line, column })
  }

  /**
   * Find the full word at the given point.
   */
  public wordAtPoint(line: number, column: number): string | null {
    throw new Error('not implemented')
    /*
    const node = this.nodeAtPoint(line, column)

    if (!node || node.childCount > 0 || node.text.trim() === '') {
      return null
    }

    return node.text.trim()
    */
  }

  /**
   * Find the name of the command at the given point.
   */
  public commandNameAtPoint(line: number, column: number): string | null {
    throw new Error('not implemented')
    /*
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
    */
  }
}
