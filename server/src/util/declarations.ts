import * as LSP from 'vscode-languageserver/node'
import * as Parser from 'web-tree-sitter'

import * as TreeSitterUtil from './tree-sitter'

const TREE_SITTER_TYPE_TO_LSP_KIND: { [type: string]: LSP.SymbolKind | undefined } = {
  // These keys are using underscores as that's the naming convention in tree-sitter.
  environment_variable_assignment: LSP.SymbolKind.Variable,
  function_definition: LSP.SymbolKind.Function,
  variable_assignment: LSP.SymbolKind.Variable,
}

export type GlobalDeclarations = { [word: string]: LSP.SymbolInformation }
export type Declarations = { [word: string]: LSP.SymbolInformation[] }

const GLOBAL_DECLARATION_LEAF_NODE_TYPES = new Set([
  'if_statement',
  'function_definition',
])

/**
 * Returns declarations (functions or variables) from a given root node
 * that would be available after sourcing the file. This currently does
 * not include global variables defined inside if statements or functions
 * as we do not do any flow tracing.
 *
 * Will only return one declaration per symbol name – the latest definition.
 * This behavior is consistent with how Bash behaves, but differs between
 * LSP servers.
 *
 * Used when finding declarations for sourced files and to get declarations
 * for the entire workspace.
 */
export function getGlobalDeclarations({
  tree,
  uri,
}: {
  tree: Parser.Tree
  uri: string
}): GlobalDeclarations {
  const globalDeclarations: GlobalDeclarations = {}

  TreeSitterUtil.forEach(tree.rootNode, (node) => {
    const followChildren = !GLOBAL_DECLARATION_LEAF_NODE_TYPES.has(node.type)

    const symbol = getDeclarationSymbolFromNode({ node, uri })
    if (symbol) {
      const word = symbol.name
      globalDeclarations[word] = symbol
    }

    return followChildren
  })

  return globalDeclarations
}

/**
 * Returns all declarations (functions or variables) from a given tree.
 * This includes local variables.
 */
export function getAllDeclarationsInTree({
  tree,
  uri,
}: {
  tree: Parser.Tree
  uri: string
}): LSP.SymbolInformation[] {
  const symbols: LSP.SymbolInformation[] = []

  TreeSitterUtil.forEach(tree.rootNode, (node) => {
    const symbol = getDeclarationSymbolFromNode({ node, uri })
    if (symbol) {
      symbols.push(symbol)
    }
  })

  return symbols
}

/**
 * Returns declarations available for the given file and location.
 * The heuristics used is a simplification compared to bash behaviour,
 * but deemed good enough, compared to the complexity of flow tracing.
 *
 * Used when getting declarations for the current scope.
 */
export function getLocalDeclarations({
  node,
  rootNode,
  uri,
}: {
  node: Parser.SyntaxNode | null
  rootNode: Parser.SyntaxNode
  uri: string
}): Declarations {
  const declarations: Declarations = {}

  // Bottom up traversal to capture all local and scoped declarations
  const walk = (node: Parser.SyntaxNode | null) => {
    // NOTE: there is also node.walk
    if (node) {
      for (const childNode of node.children) {
        let symbol: LSP.SymbolInformation | null = null

        // local variables
        if (childNode.type === 'declaration_command') {
          const variableAssignmentNode = childNode.children.filter(
            (child) => child.type === 'variable_assignment',
          )[0]

          if (variableAssignmentNode) {
            symbol = nodeToSymbolInformation({
              node: variableAssignmentNode,
              uri,
            })
          }
        } else if (childNode.type === 'for_statement') {
          const variableNode = childNode.child(1)
          if (variableNode && variableNode.type === 'variable_name') {
            symbol = LSP.SymbolInformation.create(
              variableNode.text,
              LSP.SymbolKind.Variable,
              TreeSitterUtil.range(variableNode),
              uri,
            )
          }
        } else {
          symbol = getDeclarationSymbolFromNode({ node: childNode, uri })
        }

        if (symbol) {
          if (!declarations[symbol.name]) {
            declarations[symbol.name] = []
          }
          declarations[symbol.name].push(symbol)
        }
      }

      walk(node.parent)
    }
  }

  walk(node)

  // Top down traversal to add missing global variables from within functions
  Object.entries(
    getAllGlobalVariableDeclarations({
      rootNode,
      uri,
    }),
  ).map(([name, symbols]) => {
    if (!declarations[name]) {
      declarations[name] = symbols
    }
  })

  return declarations
}

function getAllGlobalVariableDeclarations({
  uri,
  rootNode,
}: {
  uri: string
  rootNode: Parser.SyntaxNode
}) {
  const declarations: Declarations = {}

  TreeSitterUtil.forEach(rootNode, (node) => {
    if (
      node.type === 'variable_assignment' &&
      // exclude local variables
      node.parent?.type !== 'declaration_command'
    ) {
      const symbol = nodeToSymbolInformation({ node, uri })
      if (symbol) {
        if (!declarations[symbol.name]) {
          declarations[symbol.name] = []
        }
        declarations[symbol.name].push(symbol)
      }
    }

    return
  })

  return declarations
}

function nodeToSymbolInformation({
  node,
  uri,
}: {
  node: Parser.SyntaxNode
  uri: string
}): LSP.SymbolInformation | null {
  const named = node.firstNamedChild

  if (named === null) {
    return null
  }

  const containerName =
    TreeSitterUtil.findParent(node, (p) => p.type === 'function_definition')
      ?.firstNamedChild?.text || ''

  const kind = TREE_SITTER_TYPE_TO_LSP_KIND[node.type]

  return LSP.SymbolInformation.create(
    named.text,
    kind || LSP.SymbolKind.Variable,
    TreeSitterUtil.range(node),
    uri,
    containerName,
  )
}

function getDeclarationSymbolFromNode({
  node,
  uri,
}: {
  node: Parser.SyntaxNode
  uri: string
}): LSP.SymbolInformation | null {
  if (TreeSitterUtil.isDefinition(node)) {
    return nodeToSymbolInformation({ node, uri })
  } else if (node.type === 'command' && node.text.startsWith(': ')) {
    // : does argument expansion and retains the side effects.
    // A common usage is to define default values of environment variables, e.g. : "${VARIABLE:="default"}".
    const variableNode = node.namedChildren
      .find((c) => c.type === 'string')
      ?.namedChildren.find((c) => c.type === 'expansion')
      ?.namedChildren.find((c) => c.type === 'variable_name')

    if (variableNode) {
      return LSP.SymbolInformation.create(
        variableNode.text,
        LSP.SymbolKind.Variable,
        TreeSitterUtil.range(variableNode),
        uri,
      )
    }
  }

  return null
}

// The functions that follow search for a single declaration based on the
// original definition NOT the latest.

export type FindDeclarationParams = {
  /**
   * The node where the search will start.
   */
  baseNode: Parser.SyntaxNode
  symbolInfo: {
    position: LSP.Position
    uri: string
    word: string
    kind: LSP.SymbolKind
  }
  otherInfo: {
    /**
     * The current URI being searched.
     */
    currentUri: string
    /**
     * The line (LSP semantics) or row (tree-sitter semantics) at which to stop
     * searching.
     */
    boundary: LSP.uinteger
  }
}

/**
 * Searches for the original declaration of `symbol`. Global semantics here
 * means that the symbol is not local to a function, hence, `baseNode` should
 * either be a `subshell` or a `program` and `symbolInfo` should contain data
 * about a variable or a function.
 */
export function findDeclarationUsingGlobalSemantics({
  baseNode,
  symbolInfo: { position, uri, word, kind },
  otherInfo: { currentUri, boundary },
}: FindDeclarationParams) {
  let declaration: Parser.SyntaxNode | null | undefined
  let continueSearching = false

  TreeSitterUtil.forEach(baseNode, (n) => {
    if (
      (declaration && !continueSearching) ||
      n.startPosition.row > boundary ||
      (n.type === 'subshell' && !n.equals(baseNode))
    ) {
      return false
    }

    // `declaration_command`s are handled separately from `variable_assignment`s
    // because `declaration_command`s can declare variables without defining
    // them, while `variable_assignment`s require both declaration and
    // definition, so, there can be `variable_name`s within
    // `declaration_command`s that are not children of `variable_assignment`s.
    if (kind === LSP.SymbolKind.Variable && n.type === 'declaration_command') {
      const functionDefinition = TreeSitterUtil.findParentOfType(n, 'function_definition')
      const isLocalDeclaration =
        !!functionDefinition &&
        functionDefinition.lastChild?.type === 'compound_statement' &&
        ['local', 'declare', 'typeset'].includes(n.firstChild?.text as any) &&
        (baseNode.type !== 'subshell' ||
          baseNode.startPosition.row < functionDefinition.startPosition.row)

      for (const v of n.descendantsOfType('variable_name')) {
        if (
          v.text !== word ||
          TreeSitterUtil.findParentOfType(v, ['simple_expansion', 'expansion'])
        ) {
          continue
        }

        if (isLocalDeclaration) {
          // Update boundary since any other instance below `n` can now be
          // considered local to a function or out of scope.
          boundary = n.startPosition.row
          break
        }

        if (uri !== currentUri || !isDefinedVariableInExpression(n, v, position)) {
          declaration = v
          continueSearching = false
          break
        }
      }

      // This return is important as it makes sure that the next if statement
      // only catches `variable_assignment`s outside of `declaration_command`s.
      return false
    }

    if (
      kind === LSP.SymbolKind.Variable &&
      (['variable_assignment', 'for_statement'].includes(n.type) ||
        (n.type === 'command' && n.text.includes(':=')))
    ) {
      const definedVariable = n.descendantsOfType('variable_name').at(0)
      const definedVariableInExpression =
        uri === currentUri &&
        n.type === 'variable_assignment' &&
        !!definedVariable &&
        isDefinedVariableInExpression(n, definedVariable, position)

      if (definedVariable?.text === word && !definedVariableInExpression) {
        declaration = definedVariable
        continueSearching = baseNode.type === 'subshell' && n.type === 'command'

        // The original declaration could be inside a `for_statement`, so only
        // return false when the original declaration is found.
        return false
      }

      return true
    }

    if (
      kind === LSP.SymbolKind.Variable &&
      TreeSitterUtil.isVariableInReadCommand(n) &&
      n.text === word
    ) {
      declaration = n
      continueSearching = false
      return false
    }

    if (
      kind === LSP.SymbolKind.Function &&
      n.type === 'function_definition' &&
      n.firstNamedChild?.text === word
    ) {
      declaration = n.firstNamedChild
      continueSearching = false
      return false
    }

    return true
  })

  return { declaration, continueSearching }
}

/**
 * Searches for the original declaration of `symbol`. Local semantics here
 * means that the symbol is local to a function, hence, `baseNode` should
 * be the `compound_statement` of a `function_definition` and `symbolInfo`
 * should contain data about a variable.
 */
export function findDeclarationUsingLocalSemantics({
  baseNode,
  symbolInfo: { position, word },
  otherInfo: { boundary },
}: FindDeclarationParams) {
  let declaration: Parser.SyntaxNode | null | undefined
  let continueSearching = false

  TreeSitterUtil.forEach(baseNode, (n) => {
    if (
      (declaration && !continueSearching) ||
      n.startPosition.row > boundary ||
      ['function_definition', 'subshell'].includes(n.type)
    ) {
      return false
    }

    if (n.type !== 'declaration_command') {
      return true
    }

    if (!['local', 'declare', 'typeset'].includes(n.firstChild?.text as any)) {
      return false
    }

    for (const v of n.descendantsOfType('variable_name')) {
      if (
        v.text !== word ||
        TreeSitterUtil.findParentOfType(v, ['simple_expansion', 'expansion'])
      ) {
        continue
      }

      if (!isDefinedVariableInExpression(n, v, position)) {
        declaration = v
        continueSearching = false
        break
      }
    }

    return false
  })

  return { declaration, continueSearching }
}

/**
 * This is used in checking self-assignment `var=$var` edge cases where
 * `position` is within `$var`. Based on the `definition` node (should be
 * `declaration_command` or `variable_assignment`) and `variable` node (should
 * be `variable_name`) given, estimates if `position` is within the expressiion
 * (after the equals sign) of an assignment. If it is, then `var` should be
 * skipped and a higher scope should be checked for the original declaration.
 */
function isDefinedVariableInExpression(
  definition: Parser.SyntaxNode,
  variable: Parser.SyntaxNode,
  position: LSP.Position,
): boolean {
  return (
    definition.endPosition.row >= position.line &&
    (variable.endPosition.column < position.character ||
      variable.endPosition.row < position.line)
  )
}
