import { Range, Location, SymbolInformation, SymbolKind, Diagnostic, DiagnosticSeverity } from "vscode-languageserver/lib/main";
import {Document, ASTNode} from "tree-sitter"
const bash = require("tree-sitter-bash")

// Global mapping from tree-sitter node type to vscode SymbolKind
type Kinds = { [type: string]: SymbolKind }
const kinds: Kinds = {
  'environment_variable_assignment': SymbolKind.Variable,
  'function_definition': SymbolKind.Function
}

// Global map of all the declarations that we've seen, indexed by file
// and then name.
type Declarations = { [name: string]: SymbolInformation[] }
type FileDeclarations = { [uri: string]: Declarations }
const declarations: FileDeclarations = {}

// Global map from uri to the tree-sitter document.
type Documents = { [uri: string]: Document }
const documents: Documents = {}

// Global mapping from uri to the contents of the file at that uri.
// We need this to find the word at a given point etc.
type Texts = { [uri: string]: string }
const texts: Texts = {}

/**
 * Analyze the given document, cache the tree-sitter AST, and iterate over the
 * tree to find declarations.
 *
 * Returns all, if any, syntax errors that occurred while parsing the file.
 *
 */
export function analyze(uri: string, contents: string): Diagnostic[] {

  const d = new Document();
  d.setLanguage(bash);
  d.setInputString(contents);
  d.parse()

  documents[uri] = d
  declarations[uri] = {}
  texts[uri] = contents

  const problems = []


  forEach(d.rootNode, (n) => {
    if (n.type == 'ERROR') {
      problems.push(
        Diagnostic.create(
          range(n),
          'Failed to parse expression',
          DiagnosticSeverity.Error
        )
      )
      return
    }
    else if (isDefinition(n)) {
      const named = n.firstNamedChild
      const name = contents.slice(named.startIndex, named.endIndex)
      const namedDeclarations = declarations[uri][name] || []

      namedDeclarations.push(SymbolInformation.create(
        name,
        kinds[n.type],
        range(named),
        uri,
      ))
      declarations[uri][name] = namedDeclarations
    }
  });

  return problems
}

/**
 * Find all the locations where something named name has been defined.
 */
export function findDefinition(uri: string, name: string): Location[] {
  return (declarations[uri][name] || []).map(d => d.location)
}

/**
 * Find all occurrences of name in the given file.
 * It's currently not scope-aware.
 */
export function findOccurrences(uri: string, query: string): Location[] {
  const doc = documents[uri]
  const contents = texts[uri]

  const locations = []

  forEach(doc.rootNode, (n) => {

    var name: string = null
    var rng: Range = null

    if (isReference(n)) {
      const node = n.firstNamedChild || n
      name = contents.slice(node.startIndex, node.endIndex)
      rng = range(node)
    } else if (isDefinition(n)) {
      const namedNode = n.firstNamedChild
      name = contents.slice(namedNode.startIndex, namedNode.endIndex)
      rng = range(n.firstNamedChild)
    }

    if (name == query) {
      locations.push(Location.create(uri, rng))
    }

  })

  return locations
}

/**
 * Find all symbol definitions in the given file.
 */
export function findSymbols(uri: string): SymbolInformation[] {
  const declarationsInFile = declarations[uri] || []
  const ds = []
  Object.keys(declarationsInFile).forEach(n => {
    declarationsInFile[n].forEach(d => ds.push(d))
  })
  return ds
}

/**
 * Find the full word at the given point.
 */
export function wordAtPoint(uri: string, line: number, column: number): string | null {
  const document = documents[uri]
  const contents = texts[uri]

  const node = document.rootNode.namedDescendantForPosition({row: line, column: column})

  const start = node.startIndex
  const end = node.endIndex
  const name = contents.slice(start, end)

  // Hack. Might be a problem with the grammar.
  if (name.endsWith('=')) {
    return name.slice(0, name.length - 1)
  }

  return name
}

//
// Tree sitter utility functions.
//

function forEach(node: ASTNode, cb: (n: ASTNode) => void) {
  cb(node)
  if (node.children.length) {
    node.children.forEach(n => forEach(n, cb))
  }
}

function range(n: ASTNode): Range {
  return Range.create(
    n.startPosition.row,
    n.startPosition.column,
    n.endPosition.row,
    n.endPosition.column
  )
}

function isDefinition(n: ASTNode): boolean {
  switch (n.type) {
    case 'environment_variable_assignment':
    case 'local_variable_declaration':
    case 'function_definition':
        return true
      default:
        return false
  }
}

function isReference(n: ASTNode): boolean {
  switch (n.type) {
    case 'variable_name':
    case 'command_name':
        return true
      default:
        return false
  }
}
