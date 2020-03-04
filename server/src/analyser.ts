import * as fs from 'fs'
import * as request from 'request-promise-native'
import * as URI from 'urijs'
import * as LSP from 'vscode-languageserver'
import * as Parser from 'web-tree-sitter'

import { getGlobPattern } from './config'
import { BashCompletionItem, CompletionItemDataType } from './types'
import { uniqueBasedOnHash } from './util/array'
import { flattenArray, flattenObjectValues } from './util/flatten'
import { getFilePaths } from './util/fs'
import { getShebang, isBashShebang } from './util/shebang'
import * as TreeSitterUtil from './util/tree-sitter'

type Kinds = { [type: string]: LSP.SymbolKind }

type Declarations = { [name: string]: LSP.SymbolInformation[] }
type FileDeclarations = { [uri: string]: Declarations }

type Trees = { [uri: string]: Parser.Tree }
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
   * If the rootPath is provided it will initialize all shell files it can find
   * anywhere on that path. This non-exhaustive glob is used to preload the parser.
   */
  public static async fromRoot({
    connection,
    rootPath,
    parser,
  }: {
    connection: LSP.Connection
    rootPath: string | null
    parser: Parser
  }): Promise<Analyzer> {
    const analyzer = new Analyzer(parser)

    if (rootPath) {
      const globPattern = getGlobPattern()
      connection.console.log(
        `Analyzing files matching glob "${globPattern}" inside ${rootPath}`,
      )

      const lookupStartTime = Date.now()
      const getTimePassed = (): string =>
        `${(Date.now() - lookupStartTime) / 1000} seconds`

      const filePaths = await getFilePaths({ globPattern, rootPath })

      // TODO: we could load all files without extensions: globPattern: '**/[^.]'

      connection.console.log(
        `Glob resolved with ${filePaths.length} files after ${getTimePassed()}`,
      )

      filePaths.forEach(filePath => {
        const uri = `file://${filePath}`
        connection.console.log(`Analyzing ${uri}`)

        const fileContent = fs.readFileSync(filePath, 'utf8')

        const shebang = getShebang(fileContent)
        if (shebang && !isBashShebang(shebang)) {
          connection.console.log(`Skipping file ${uri} with shebang "${shebang}"`)
          return
        }

        analyzer.analyze(uri, LSP.TextDocument.create(uri, 'shell', 1, fileContent))
      })

      connection.console.log(`Analyzer finished after ${getTimePassed()}`)
    }

    return analyzer
  }

  private parser: Parser

  private uriToTextDocument: { [uri: string]: LSP.TextDocument } = {}

  private uriToTreeSitterTrees: Trees = {}

  // We need this to find the word at a given point etc.
  private uriToFileContent: Texts = {}

  private uriToDeclarations: FileDeclarations = {}

  private treeSitterTypeToLSPKind: Kinds = {
    // These keys are using underscores as that's the naming convention in tree-sitter.
    /* eslint-disable @typescript-eslint/camelcase */
    environment_variable_assignment: LSP.SymbolKind.Variable,
    function_definition: LSP.SymbolKind.Function,
    variable_assignment: LSP.SymbolKind.Variable,
    /* eslint-enable @typescript-eslint/camelcase */
  }

  public constructor(parser: Parser) {
    this.parser = parser
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

  public async getExplainshellDocumentation({
    params,
    endpoint,
  }: {
    params: LSP.TextDocumentPositionParams
    endpoint: string
  }): Promise<any> {
    const leafNode = this.uriToTreeSitterTrees[
      params.textDocument.uri
    ].rootNode.descendantForPosition({
      row: params.position.line,
      column: params.position.character,
    })

    // explainshell needs the whole command, not just the "word" (tree-sitter
    // parlance) that the user hovered over. A relatively successful heuristic
    // is to simply go up one level in the AST. If you go up too far, you'll
    // start to include newlines, and explainshell completely balks when it
    // encounters newlines.
    const interestingNode = leafNode.type === 'word' ? leafNode.parent : leafNode

    const cmd = this.uriToFileContent[params.textDocument.uri].slice(
      interestingNode.startIndex,
      interestingNode.endIndex,
    )

    // FIXME: type the response and unit test it
    const explainshellResponse = await request({
      uri: URI(endpoint)
        .path('/api/explain')
        .addQuery('cmd', cmd)
        .toString(),
      json: true,
    })

    // Attaches debugging information to the return value (useful for logging to
    // VS Code output).
    const response = { ...explainshellResponse, cmd, cmdType: interestingNode.type }

    if (explainshellResponse.status === 'error') {
      return response
    } else if (!explainshellResponse.matches) {
      return { ...response, status: 'error' }
    } else {
      const offsetOfMousePointerInCommand =
        this.uriToTextDocument[params.textDocument.uri].offsetAt(params.position) -
        interestingNode.startIndex

      const match = explainshellResponse.matches.find(
        (helpItem: any) =>
          helpItem.start <= offsetOfMousePointerInCommand &&
          offsetOfMousePointerInCommand < helpItem.end,
      )

      const helpHTML = match && match.helpHTML

      if (!helpHTML) {
        return { ...response, status: 'error' }
      }

      return { ...response, helpHTML }
    }
  }

  /**
   * Find all the locations where something named name has been defined.
   */
  public findReferences(name: string): LSP.Location[] {
    const uris = Object.keys(this.uriToTreeSitterTrees)
    return flattenArray(uris.map(uri => this.findOccurrences(uri, name)))
  }

  /**
   * Find all occurrences of name in the given file.
   * It's currently not scope-aware.
   */
  public findOccurrences(uri: string, query: string): LSP.Location[] {
    const tree = this.uriToTreeSitterTrees[uri]
    const contents = this.uriToFileContent[uri]

    const locations: LSP.Location[] = []

    TreeSitterUtil.forEach(tree.rootNode, n => {
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
  public findSymbolCompletions(uri: string): BashCompletionItem[] {
    const hashFunction = ({ name, kind }: LSP.SymbolInformation) => `${name}${kind}`

    return uniqueBasedOnHash(this.findSymbols(uri), hashFunction).map(
      (symbol: LSP.SymbolInformation) => ({
        label: symbol.name,
        kind: this.symbolKindToCompletionKind(symbol.kind),
        data: {
          name: symbol.name,
          type: CompletionItemDataType.Symbol,
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
  public analyze(uri: string, document: LSP.TextDocument): LSP.Diagnostic[] {
    const contents = document.getText()

    const tree = this.parser.parse(contents)

    this.uriToTextDocument[uri] = document
    this.uriToTreeSitterTrees[uri] = tree
    this.uriToDeclarations[uri] = {}
    this.uriToFileContent[uri] = contents

    const problems: LSP.Diagnostic[] = []

    TreeSitterUtil.forEach(tree.rootNode, (n: Parser.SyntaxNode) => {
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

    function findMissingNodes(node: Parser.SyntaxNode) {
      if (node.isMissing()) {
        problems.push(
          LSP.Diagnostic.create(
            TreeSitterUtil.range(node),
            `Syntax error: expected "${node.type}" somewhere in the file`,
            LSP.DiagnosticSeverity.Warning,
          ),
        )
      } else if (node.hasError()) {
        node.children.forEach(findMissingNodes)
      }
    }

    findMissingNodes(tree.rootNode)

    return problems
  }

  /**
   * Find the full word at the given point.
   */
  public wordAtPoint(uri: string, line: number, column: number): string | null {
    const document = this.uriToTreeSitterTrees[uri]
    const contents = this.uriToFileContent[uri]

    if (!document.rootNode) {
      // Check for lacking rootNode (due to failed parse?)
      return null
    }

    const point = { row: line, column }

    const node = TreeSitterUtil.namedLeafDescendantForPosition(point, document.rootNode)

    if (!node) {
      return null
    }

    const start = node.startIndex
    const end = node.endIndex
    const name = contents.slice(start, end)

    // Hack. Might be a problem with the grammar.
    // TODO: Document this with a test case
    if (name.endsWith('=')) {
      return name.slice(0, name.length - 1)
    }

    return name
  }

  private symbolKindToCompletionKind(s: LSP.SymbolKind): LSP.CompletionItemKind {
    switch (s) {
      case LSP.SymbolKind.File:
        return LSP.CompletionItemKind.File
      case LSP.SymbolKind.Module:
      case LSP.SymbolKind.Namespace:
      case LSP.SymbolKind.Package:
        return LSP.CompletionItemKind.Module
      case LSP.SymbolKind.Class:
        return LSP.CompletionItemKind.Class
      case LSP.SymbolKind.Method:
        return LSP.CompletionItemKind.Method
      case LSP.SymbolKind.Property:
        return LSP.CompletionItemKind.Property
      case LSP.SymbolKind.Field:
        return LSP.CompletionItemKind.Field
      case LSP.SymbolKind.Constructor:
        return LSP.CompletionItemKind.Constructor
      case LSP.SymbolKind.Enum:
        return LSP.CompletionItemKind.Enum
      case LSP.SymbolKind.Interface:
        return LSP.CompletionItemKind.Interface
      case LSP.SymbolKind.Function:
        return LSP.CompletionItemKind.Function
      case LSP.SymbolKind.Variable:
        return LSP.CompletionItemKind.Variable
      case LSP.SymbolKind.Constant:
        return LSP.CompletionItemKind.Constant
      case LSP.SymbolKind.String:
      case LSP.SymbolKind.Number:
      case LSP.SymbolKind.Boolean:
      case LSP.SymbolKind.Array:
      case LSP.SymbolKind.Key:
      case LSP.SymbolKind.Null:
        return LSP.CompletionItemKind.Text
      case LSP.SymbolKind.Object:
        return LSP.CompletionItemKind.Module
      case LSP.SymbolKind.EnumMember:
        return LSP.CompletionItemKind.EnumMember
      case LSP.SymbolKind.Struct:
        return LSP.CompletionItemKind.Struct
      case LSP.SymbolKind.Event:
        return LSP.CompletionItemKind.Event
      case LSP.SymbolKind.Operator:
        return LSP.CompletionItemKind.Operator
      case LSP.SymbolKind.TypeParameter:
        return LSP.CompletionItemKind.TypeParameter
      default:
        return LSP.CompletionItemKind.Text
    }
  }
}
