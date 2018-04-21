// tslint:disable:no-submodule-imports
import * as fs from 'fs'
import * as glob from 'glob'
import * as Path from 'path'

import { Document } from 'tree-sitter'
import * as bash from 'tree-sitter-bash'
import * as LSP from 'vscode-languageserver'

import { uniqueBasedOnHash } from './util/array'
import { flattenArray, flattenObjectValues } from './util/flatten'
import * as TreeSitterUtil from './util/tree-sitter'

type Kinds = { [type: string]: LSP.SymbolKind }

type Declarations = { [name: string]: LSP.SymbolInformation[] }
type FileDeclarations = { [uri: string]: Declarations }

type Documents = { [uri: string]: Document }
type Texts = { [uri: string]: string }

/**
 * The Analyzer uses the Abstract Syntax Trees (ASTs) that are provided by
 * tree-sitter to find definitions, reference, etc.
 */
export default class Analyzer {
  /**
   * Initialize the Analyzer based on a connection to the client and an optional
   * root path.
   *
   * If the rootPath is provided it will initialize all *.sh files it can find
   * anywhere on that path.
   */
  public static fromRoot(
    connection: LSP.Connection,
    rootPath: string | null,
  ): Promise<Analyzer> {
    // This happens if the users opens a single bash script without having the
    // 'window' associated with a specific project.
    if (!rootPath) {
      return Promise.resolve(new Analyzer())
    }

    return new Promise((resolve, reject) => {
      glob('**/*.sh', { cwd: rootPath }, (err, paths) => {
        if (err != null) {
          reject(err)
        } else {
          const analyzer = new Analyzer()
          paths.forEach(p => {
            const absolute = Path.join(rootPath, p)
            const uri = 'file://' + absolute
            connection.console.log('Analyzing ' + uri)
            analyzer.analyze(uri, fs.readFileSync(absolute, 'utf8'))
          })
          resolve(analyzer)
        }
      })
    })
  }

  private uriToTreeSitterDocument: Documents = {}

  // We need this to find the word at a given point etc.
  private uriToFileContent: Texts = {}

  private uriToDeclarations: FileDeclarations = {}

  private treeSitterTypeToLSPKind: Kinds = {
    // These keys are using underscores as that's the naming convention in tree-sitter.
    environment_variable_assignment: LSP.SymbolKind.Variable,
    function_definition: LSP.SymbolKind.Function,
  }

  /**
   * Find all the locations where something named name has been defined.
   */
  public findDefinition(name: string): LSP.Location[] {
    const symbols: LSP.SymbolInformation[] = []
    Object.keys(this.uriToDeclarations).forEach(uri => {
      const declarationNames = this.uriToDeclarations[uri][name] || []
      declarationNames.forEach(d => symbols.push(d))
    })
    return symbols.map(s => s.location)
  }

  /**
   * Find all the locations where something named name has been defined.
   */
  public findReferences(name: string): LSP.Location[] {
    const uris = Object.keys(this.uriToTreeSitterDocument)
    return flattenArray(uris.map(uri => this.findOccurrences(uri, name)))
  }

  /**
   * Find all occurrences of name in the given file.
   * It's currently not scope-aware.
   */
  public findOccurrences(uri: string, query: string): LSP.Location[] {
    const doc = this.uriToTreeSitterDocument[uri]
    const contents = this.uriToFileContent[uri]

    const locations = []

    TreeSitterUtil.forEach(doc.rootNode, n => {
      let name: string = null
      let rng: LSP.Range = null

      if (TreeSitterUtil.isReference(n)) {
        const node = n.firstNamedChild || n
        name = contents.slice(node.startIndex, node.endIndex)
        rng = TreeSitterUtil.range(node)
      } else if (TreeSitterUtil.isDefinition(n)) {
        const namedNode = n.firstNamedChild
        name = contents.slice(namedNode.startIndex, namedNode.endIndex)
        rng = TreeSitterUtil.range(n.firstNamedChild)
      }

      if (name === query) {
        locations.push(LSP.Location.create(uri, rng))
      }
    })

    return locations
  }

  /**
   * Find all symbol definitions in the given file.
   */
  public findSymbols(uri: string): LSP.SymbolInformation[] {
    const declarationsInFile = this.uriToDeclarations[uri] || {}
    return flattenObjectValues(declarationsInFile)
  }

  /**
   * Find unique symbol completions for the given file.
   */
  public findSymbolCompletions(uri: string): LSP.CompletionItem[] {
    const hashFunction = ({ name, kind }) => `${name}${kind}`

    return uniqueBasedOnHash(this.findSymbols(uri), hashFunction).map(
      (symbol: LSP.SymbolInformation) => ({
        label: symbol.name,
        kind: symbol.kind,
        data: {
          name: symbol.name,
          type: 'function',
        },
      }),
    )
  }

  /**
   * Analyze the given document, cache the tree-sitter AST, and iterate over the
   * tree to find declarations.
   *
   * Returns all, if any, syntax errors that occurred while parsing the file.
   *
   */
  public analyze(uri: string, contents: string): LSP.Diagnostic[] {
    const d = new Document()
    d.setLanguage(bash)
    d.setInputString(contents)
    d.parse()

    this.uriToTreeSitterDocument[uri] = d
    this.uriToDeclarations[uri] = {}
    this.uriToFileContent[uri] = contents

    const problems = []

    TreeSitterUtil.forEach(d.rootNode, n => {
      if (n.type === 'ERROR') {
        problems.push(
          LSP.Diagnostic.create(
            TreeSitterUtil.range(n),
            'Failed to parse expression',
            LSP.DiagnosticSeverity.Error,
          ),
        )
        return
      } else if (TreeSitterUtil.isDefinition(n)) {
        const named = n.firstNamedChild
        const name = contents.slice(named.startIndex, named.endIndex)
        const namedDeclarations = this.uriToDeclarations[uri][name] || []

        const parent = TreeSitterUtil.findParent(n, p => p.type === 'function_definition')
        const parentName = parent
          ? contents.slice(
              parent.firstNamedChild.startIndex,
              parent.firstNamedChild.endIndex,
            )
          : null

        namedDeclarations.push(
          LSP.SymbolInformation.create(
            name,
            this.treeSitterTypeToLSPKind[n.type],
            TreeSitterUtil.range(n),
            uri,
            parentName,
          ),
        )
        this.uriToDeclarations[uri][name] = namedDeclarations
      }
    })

    return problems
  }

  /**
   * Find the full word at the given point.
   */
  public wordAtPoint(uri: string, line: number, column: number): string | null {
    const document = this.uriToTreeSitterDocument[uri]
    const contents = this.uriToFileContent[uri]

    const node = document.rootNode.namedDescendantForPosition({ row: line, column })

    const start = node.startIndex
    const end = node.endIndex
    const name = contents.slice(start, end)

    // Hack. Might be a problem with the grammar.
    if (name.endsWith('=')) {
      return name.slice(0, name.length - 1)
    }

    return name
  }
}
