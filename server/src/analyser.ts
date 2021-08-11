import * as fs from 'fs'
import * as FuzzySearch from 'fuzzy-search'
import * as request from 'request-promise-native'
import * as URI from 'urijs'
import { promisify } from 'util'
import * as LSP from 'vscode-languageserver'
import * as Parser from 'web-tree-sitter'

import { getGlobPattern } from './config'
import { flattenArray, flattenObjectValues } from './util/flatten'
import { getFilePaths } from './util/fs'
import { getShebang, isBashShebang } from './util/shebang'
import * as TreeSitterUtil from './util/tree-sitter'

const readFileAsync = promisify(fs.readFile)

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
    rootPath: LSP.InitializeParams['rootPath']
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

      let filePaths: string[] = []
      try {
        filePaths = await getFilePaths({ globPattern, rootPath })
      } catch (error) {
        connection.window.showWarningMessage(
          `Failed to analyze bash files using the glob "${globPattern}". The experience will be degraded. Error: ${error.message}`,
        )
      }

      // TODO: we could load all files without extensions: globPattern: '**/[^.]'

      connection.console.log(
        `Glob resolved with ${filePaths.length} files after ${getTimePassed()}`,
      )

      for (const filePath of filePaths) {
        const uri = `file://${filePath}`
        connection.console.log(`Analyzing ${uri}`)

        try {
          const fileContent = await readFileAsync(filePath, 'utf8')
          const shebang = getShebang(fileContent)
          if (shebang && !isBashShebang(shebang)) {
            connection.console.log(`Skipping file ${uri} with shebang "${shebang}"`)
            continue
          }

          analyzer.analyze(uri, LSP.TextDocument.create(uri, 'shell', 1, fileContent))
        } catch (error) {
          connection.console.warn(`Failed analyzing ${uri}. Error: ${error.message}`)
        }
      }

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

  /**
   * Find all the symbols matching the query using fuzzy search.
   */
  public search(query: string): LSP.SymbolInformation[] {
    const searcher = new FuzzySearch(this.getAllSymbols(), ['name'], {
      caseSensitive: true,
    })
    return searcher.search(query)
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

    if (!interestingNode) {
      return {
        status: 'error',
        message: 'no interestingNode found',
      }
    }

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
      let name: null | string = null
      let range: null | LSP.Range = null

      if (TreeSitterUtil.isReference(n)) {
        const node = n.firstNamedChild || n
        name = contents.slice(node.startIndex, node.endIndex)
        range = TreeSitterUtil.range(node)
      } else if (TreeSitterUtil.isDefinition(n)) {
        const namedNode = n.firstNamedChild
        if (namedNode) {
          name = contents.slice(namedNode.startIndex, namedNode.endIndex)
          range = TreeSitterUtil.range(namedNode)
        }
      }

      if (name === query && range !== null) {
        locations.push(LSP.Location.create(uri, range))
      }
    })

    return locations
  }

  /**
   * Find all symbol definitions in the given file.
   */
  public findSymbolsForFile({ uri }: { uri: string }): LSP.SymbolInformation[] {
    const declarationsInFile = this.uriToDeclarations[uri] || {}
    return flattenObjectValues(declarationsInFile)
  }

  /**
   * Find symbol completions for the given word.
   */
  public findSymbolsMatchingWord({
    exactMatch,
    word,
  }: {
    exactMatch: boolean
    word: string
  }): LSP.SymbolInformation[] {
    const symbols: LSP.SymbolInformation[] = []

    Object.keys(this.uriToDeclarations).forEach(uri => {
      const declarationsInFile = this.uriToDeclarations[uri] || {}
      Object.keys(declarationsInFile).map(name => {
        const match = exactMatch ? name === word : name.startsWith(word)
        if (match) {
          declarationsInFile[name].forEach(symbol => symbols.push(symbol))
        }
      })
    })

    return symbols
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

        if (named === null) {
          return
        }

        const name = contents.slice(named.startIndex, named.endIndex)
        const namedDeclarations = this.uriToDeclarations[uri][name] || []

        const parent = TreeSitterUtil.findParent(n, p => p.type === 'function_definition')
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
   * Find the node at the given point.
   */
  private nodeAtPoint(
    uri: string,
    line: number,
    column: number,
  ): Parser.SyntaxNode | null {
    const document = this.uriToTreeSitterTrees[uri]

    if (!document.rootNode) {
      // Check for lacking rootNode (due to failed parse?)
      return null
    }

    return document.rootNode.descendantForPosition({ row: line, column })
  }

  /**
   * Find the full word at the given point.
   */
  public wordAtPoint(uri: string, line: number, column: number): string | null {
    const node = this.nodeAtPoint(uri, line, column)

    if (!node || node.childCount > 0 || node.text.trim() === '') {
      return null
    }

    return node.text.trim()
  }

  /**
   * Find the name of the command at the given point.
   */
  public commandNameAtPoint(uri: string, line: number, column: number): string | null {
    let node = this.nodeAtPoint(uri, line, column)

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

  /**
   * Find a block of comments above a line position
   */
  public commentsAbove(uri: string, line: number): string | null {
    const doc = this.uriToTextDocument[uri]

    const commentBlock = []

    // start from the line above
    let commentBlockIndex = line - 1

    // will return the comment string without the comment '#'
    // and without leading whitespace, or null if the line 'l'
    // is not a comment line
    const getComment = (l: string): null | string => {
      // this regexp has to be defined within the function
      const commentRegExp = /^\s*#\s*(.*)/g
      const matches = commentRegExp.exec(l)
      return matches ? matches[1].trim() : null
    }

    let currentLine = doc.getText({
      start: { line: commentBlockIndex, character: 0 },
      end: { line: commentBlockIndex + 1, character: 0 },
    })

    // iterate on every line above and including
    // the current line until getComment returns null
    let currentComment: string | null = ''
    while ((currentComment = getComment(currentLine))) {
      commentBlock.push(currentComment)
      commentBlockIndex -= 1
      currentLine = doc.getText({
        start: { line: commentBlockIndex, character: 0 },
        end: { line: commentBlockIndex + 1, character: 0 },
      })
    }

    if (commentBlock.length) {
      // since we searched from bottom up, we then reverse
      // the lines so that it reads top down.
      return commentBlock.reverse().join('\n')
    }

    // no comments found above line:
    return null
  }

  public getAllVariableSymbols(): LSP.SymbolInformation[] {
    return this.getAllSymbols().filter(symbol => symbol.kind === LSP.SymbolKind.Variable)
  }

  private getAllSymbols(): LSP.SymbolInformation[] {
    // NOTE: this could be cached, it takes < 1 ms to generate for a project with 250 bash files...
    const symbols: LSP.SymbolInformation[] = []

    Object.keys(this.uriToDeclarations).forEach(uri => {
      Object.keys(this.uriToDeclarations[uri]).forEach(name => {
        const declarationNames = this.uriToDeclarations[uri][name] || []
        declarationNames.forEach(d => symbols.push(d))
      })
    })

    return symbols
  }
}
