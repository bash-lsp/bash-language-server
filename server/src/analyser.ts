import { TextDocument, Range, Location } from "vscode-languageserver/lib/main";
import {Document} from "tree-sitter"
const bash = require("tree-sitter-bash")

import * as Ast from "./ast";

// hack.
function forEach(node, cb) {
  cb(node)
  if (node.children.length) {
    node.children.forEach(n => forEach(n, cb))
  }
}

type Declarations = {
  [name: string]: [Ast.Declaration]
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

export function analyze(document: TextDocument): void {

  const contents = document.getText();

  const d = new Document();
  d.setLanguage(bash);
  d.setInputString(contents);
  d.parse()

  documents[document.uri] = d
  state[document.uri] = {}
  texts[document.uri] = contents

  forEach(d.rootNode, (n) => {
    if (n.type == 'environment_variable_assignment') {
      const named = n.firstNamedChild
      const name = contents.slice(named.startIndex, named.endIndex)
      const v = Ast.Variable(
        name,
        named.startPosition.row,
        named.startPosition.column,
        named.endPosition.row,
        named.endPosition.column
      )

      const decls = state[document.uri] || []
      const forName = decls[name] || []
      forName.push(v)
      state[document.uri][name] = forName

    } else if (n.type === 'function_definition') {
      const named = n.firstNamedChild
      const name = contents.slice(named.startIndex, named.endIndex)
      const f = Ast.Function(
        name,
        named.startPosition.row,
        named.startPosition.column,
        named.endPosition.row,
        named.endPosition.column
      )

      const decls = state[document.uri] || []
      const forName = decls[name] || []
      forName.push(f)
      state[document.uri][name] = forName
    }
  });
}

export function findDefinition(uri: string, name: string): Location[] {
  const declarations = state[uri][name]
  return declarations.map(d => Location.create(
    uri,
    Range.create(d.startLine, d.startColumn, d.endLine, d.endColumn)
  ))
}

export function wordAtPoint(uri: string, line: number, column: number): string | null {
  const document = documents[uri]
  const contents = texts[uri]

  const node = document.rootNode.namedDescendantForPosition({row: line, column: column})

  const start = node.startIndex
  const end = node.endIndex
  const name = contents.slice(start, end)

  return name
}
