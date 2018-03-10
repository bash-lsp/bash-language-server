// tslint:disable:no-submodule-imports
import * as fs from 'fs'
import * as glob from 'glob'
import * as Path from 'path'

import { Document } from 'tree-sitter'
import * as bash from 'tree-sitter-bash'
import * as LSP from 'vscode-languageserver'

import * as TreeSitterUtil from './util/tree-sitter'

type Kinds = { [type: string]: LSP.SymbolKind }

type Declarations = { [name: string]: LSP.SymbolInformation[] }
type FileDeclarations = { [uri: string]: Declarations }

type Documents = { [uri: string]: Document }
type Texts = { [uri: string]: string }

/**
 * The Analyzer uses the Abstract Syntax Trees (ASTs) that are provdied by
 * tree-sitter to find definitions, reference, etc.
 */
export class Analyzer {
  /**
   * Initialize the Analyzer based on a connection to the client and an optional
   * root path.
   *
   * If the rootPath is provided it will iniailize all *.sh files it can find
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

  // Global map from uri to the tree-sitter document.
  private documents: Documents = {}

  // Global mapping from uri to the contents of the file at that uri.
  // We need this to find the word at a given point etc.
  private texts: Texts = {}

  // Global map of all the declarations that we've seen, indexed by file
  // and then name.
  private declarations: FileDeclarations = {}

  // Global mapping from tree-sitter node type to vscode SymbolKind
  private kinds: Kinds = {
    environment_variable_assignment: LSP.SymbolKind.Variable,
    function_definition: LSP.SymbolKind.Function,
  }

  /**
   * Find all the locations where something named name has been defined.
   */
  public findDefinition(name: string): LSP.Location[] {
    const symbols: LSP.SymbolInformation[] = []
    Object.keys(this.declarations).forEach(uri => {
      const declarationNames = this.declarations[uri][name] || []
      declarationNames.forEach(d => symbols.push(d))
    })
    return symbols.map(s => s.location)
  }

  /**
   * Find all the locations where something named name has been defined.
   */
  public findReferences(name: string): LSP.Location[] {
    const locations = []
    Object.keys(this.documents).forEach(uri => {
      this.findOccurrences(uri, name).forEach(l => locations.push(l))
    })
    return locations
  }

  /**
   * Find all occurrences of name in the given file.
   * It's currently not scope-aware.
   */
  public findOccurrences(uri: string, query: string): LSP.Location[] {
    const doc = this.documents[uri]
    const contents = this.texts[uri]

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
    const declarationsInFile = this.declarations[uri] || []
    const ds = []
    Object.keys(declarationsInFile).forEach(n => {
      declarationsInFile[n].forEach(d => ds.push(d))
    })
    return ds
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

    this.documents[uri] = d
    this.declarations[uri] = {}
    this.texts[uri] = contents

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
        const namedDeclarations = this.declarations[uri][name] || []

        namedDeclarations.push(
          LSP.SymbolInformation.create(
            name,
            this.kinds[n.type],
            TreeSitterUtil.range(named),
            uri,
          ),
        )
        this.declarations[uri][name] = namedDeclarations
      }
    })

    return problems
  }

  /**
   * Find the full word at the given point.
   */
  public wordAtPoint(uri: string, line: number, column: number): string | null {
    const document = this.documents[uri]
    const contents = this.texts[uri]

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
