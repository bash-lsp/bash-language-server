import { TextDocument, Range, Location, SymbolInformation, SymbolKind, Diagnostic, DiagnosticSeverity } from "vscode-languageserver/lib/main";
import {Document} from "tree-sitter"
const bash = require("tree-sitter-bash")


// hack.
function forEach(node, cb) {
  cb(node)
  if (node.children.length) {
    node.children.forEach(n => forEach(n, cb))
  }
}

type Declarations = {
  [name: string]: [SymbolInformation]
}

type State = {
  [uri: string]: Declarations
}

type Documents = {
  [uri: string]: Document
}

type Texts = {
  [uri: string]: string
}

const state: State = {}
const documents: Documents = {}
const texts: Texts = {}

export function analyze(document: TextDocument): Diagnostic[] {

  const uri = document.uri
  const contents = document.getText();

  const d = new Document();
  d.setLanguage(bash);
  d.setInputString(contents);
  d.parse()

  documents[document.uri] = d
  state[document.uri] = {}
  texts[document.uri] = contents

  const problems = []

  forEach(d.rootNode, (n) => {
    if (n.type == 'environment_variable_assignment') {
      const named = n.firstNamedChild
      const name = contents.slice(named.startIndex, named.endIndex)
      const v = SymbolInformation.create(
        name,
        SymbolKind.Variable,
        Range.create(
          named.startPosition.row,
          named.startPosition.column,
          named.endPosition.row,
          named.endPosition.column
        ),
        uri,
      )

      const decls = state[document.uri] || []
      const forName = decls[name] || []
      forName.push(v)
      state[document.uri][name] = forName

    } else if (n.type === 'function_definition') {
      const named = n.firstNamedChild
      const name = contents.slice(named.startIndex, named.endIndex)
      const f = SymbolInformation.create(
        name,
        SymbolKind.Function,
        Range.create(
          named.startPosition.row,
          named.startPosition.column,
          named.endPosition.row,
          named.endPosition.column
        ),
        uri,
      )

      const decls = state[document.uri] || []
      const forName = decls[name] || []
      forName.push(f)
      state[document.uri][name] = forName
    } else if (n.type == 'ERROR') {
      const r = Range.create(
        n.startPosition.row,
        n.startPosition.column,
        n.endPosition.row,
        n.endPosition.column
      )
      problems.push(Diagnostic.create(r, 'Failed to parse expression', DiagnosticSeverity.Error))
    }
  });

  return problems
}

export function findDefinition(uri: string, name: string): Location[] {
  const declarations = state[uri][name]
  return declarations.map(d => d.location)
}

export function findOccurrences(uri: string, name: string): Location[] {
  const doc = documents[uri]
  const contents = texts[uri]

  const locations = []

  forEach(doc.rootNode, (n) => {
    if (n.type === 'variable_name') {
      const nodeName = contents.slice(n.startIndex, n.endIndex)
      if (nodeName == name) {
        locations.push(Location.create(
          uri,
          Range.create(
            n.startPosition.row,
            n.startPosition.column,
            n.endPosition.row,
            n.endPosition.column
          )
        ))
      }
    }
  })

  return locations
}

export function findSymbols(uri: string): SymbolInformation[] {
  const declarations: Declarations = state[uri]
  const ds = []
  Object.keys(declarations).forEach(n => {
    declarations[n].forEach(d => ds.push(d))
  })
  return ds
}

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
