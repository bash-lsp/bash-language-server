import * as fs from 'fs'
import * as FuzzySearch from 'fuzzy-search'
import fetch from 'node-fetch'
import * as URI from 'urijs'
import * as url from 'url'
import { promisify } from 'util'
import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as Parser from 'web-tree-sitter'

import { flattenArray, flattenObjectValues } from './util/flatten'
import { getFilePaths } from './util/fs'
import { analyzeShebang } from './util/shebang'
import * as sourcing from './util/sourcing'
import * as TreeSitterUtil from './util/tree-sitter'

const readFileAsync = promisify(fs.readFile)

type Kinds = { [type: string]: LSP.SymbolKind }

type Declarations = { [word: string]: LSP.SymbolInformation[] }
type FileDeclarations = { [uri: string]: Declarations }

type Trees = { [uri: string]: Parser.Tree }
type Texts = { [uri: string]: string }

/**
 * The Analyzer uses the Abstract Syntax Trees (ASTs) that are provided by
 * tree-sitter to find definitions, reference, etc.
 */
export default class Analyzer {
  private parser: Parser
  private console: LSP.RemoteConsole
  private uriToTextDocument: { [uri: string]: TextDocument } = {}
  private uriToTreeSitterTrees: Trees = {}

  // We need this to find the word at a given point etc.
  private uriToFileContent: Texts = {}
  private uriToDeclarations: FileDeclarations = {}
  private uriToSourcedUris: { [uri: string]: Set<string> } = {}
  private treeSitterTypeToLSPKind: Kinds = {
    // These keys are using underscores as that's the naming convention in tree-sitter.
    environment_variable_assignment: LSP.SymbolKind.Variable,
    function_definition: LSP.SymbolKind.Function,
    variable_assignment: LSP.SymbolKind.Variable,
  }

  private includeAllWorkspaceSymbols: boolean
  private workspaceFolder: string | null

  public constructor({
    console,
    includeAllWorkspaceSymbols = false,
    parser,
    workspaceFolder,
  }: {
    console: LSP.RemoteConsole
    includeAllWorkspaceSymbols?: boolean
    parser: Parser
    workspaceFolder: string | null
  }) {
    this.console = console
    this.includeAllWorkspaceSymbols = includeAllWorkspaceSymbols
    this.parser = parser
    this.workspaceFolder = workspaceFolder
  }

  /**
   * Initiates a background analysis of the files in the workspaceFolder to
   * enable features across files.
   *
   * NOTE: if the source aware feature works well, we can likely remove this and
   * rely on parsing files as they are sourced.
   */
  public async initiateBackgroundAnalysis({
    backgroundAnalysisMaxFiles,
    globPattern,
  }: {
    backgroundAnalysisMaxFiles: number
    globPattern: string
  }): Promise<{ filesParsed: number }> {
    const rootPath = this.workspaceFolder
    if (!rootPath) {
      return { filesParsed: 0 }
    }

    if (backgroundAnalysisMaxFiles <= 0) {
      this.console.log(
        `BackgroundAnalysis: skipping as backgroundAnalysisMaxFiles was 0...`,
      )
      return { filesParsed: 0 }
    }

    this.console.log(
      `BackgroundAnalysis: resolving glob "${globPattern}" inside "${rootPath}"...`,
    )

    const lookupStartTime = Date.now()
    const getTimePassed = (): string => `${(Date.now() - lookupStartTime) / 1000} seconds`

    let filePaths: string[] = []
    try {
      filePaths = await getFilePaths({
        globPattern,
        rootPath,
        maxItems: backgroundAnalysisMaxFiles,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : error
      this.console.warn(
        `BackgroundAnalysis: failed resolved glob "${globPattern}". The experience across files will be degraded. Error: ${errorMessage}`,
      )
      return { filesParsed: 0 }
    }

    this.console.log(
      `BackgroundAnalysis: Glob resolved with ${
        filePaths.length
      } files after ${getTimePassed()}`,
    )

    for (const filePath of filePaths) {
      const uri = url.pathToFileURL(filePath).href

      try {
        const fileContent = await readFileAsync(filePath, 'utf8')
        const { shebang, shellDialect } = analyzeShebang(fileContent)
        if (shebang && !shellDialect) {
          this.console.log(
            `BackgroundAnalysis: Skipping file ${uri} with shebang "${shebang}"`,
          )
          continue
        }

        this.analyze({
          document: TextDocument.create(uri, 'shell', 1, fileContent),
          uri,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : error
        this.console.warn(
          `BackgroundAnalysis: Failed analyzing ${uri}. Error: ${errorMessage}`,
        )
      }
    }

    this.console.log(`BackgroundAnalysis: Completed after ${getTimePassed()}.`)
    return {
      filesParsed: filePaths.length,
    }
  }

  /**
   * Find all the locations where something has been defined.
   */
  public findDefinition({
    position,
    uri,
    word,
  }: {
    position?: { line: number; character: number }
    uri: string
    word: string
  }): LSP.Location[] {
    const tree = this.uriToTreeSitterTrees[uri]
    if (position && tree) {
      // NOTE: when a word is a file path to a sourced file, we return a location it.
      const sourcedLocation = sourcing.getSourcedLocation({
        position,
        rootPath: this.workspaceFolder,
        tree,
        uri,
        word,
      })
      if (sourcedLocation) {
        return [sourcedLocation]
      }
    }

    const fileDeclarations = this.getReachableUriToDeclarations({ uri })

    return Object.keys(fileDeclarations)
      .reduce((symbols, uri) => {
        const declarationNames = fileDeclarations[uri][word] || []
        declarationNames.forEach((d) => symbols.push(d))
        return symbols
      }, [] as LSP.SymbolInformation[])
      .map((symbol) => symbol.location)
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
  }): Promise<{ helpHTML?: string }> {
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
      return {}
    }

    const cmd = this.uriToFileContent[params.textDocument.uri].slice(
      interestingNode.startIndex,
      interestingNode.endIndex,
    )
    type ExplainshellResponse = {
      matches?: Array<{ helpHTML: string; start: number; end: number }>
    }

    const url = URI(endpoint).path('/api/explain').addQuery('cmd', cmd).toString()
    const explainshellRawResponse = await fetch(url)
    const explainshellResponse =
      (await explainshellRawResponse.json()) as ExplainshellResponse

    if (!explainshellRawResponse.ok) {
      throw new Error(`HTTP request failed: ${url}`)
    } else if (!explainshellResponse.matches) {
      return {}
    } else {
      const offsetOfMousePointerInCommand =
        this.uriToTextDocument[params.textDocument.uri].offsetAt(params.position) -
        interestingNode.startIndex

      const match = explainshellResponse.matches.find(
        (helpItem) =>
          helpItem.start <= offsetOfMousePointerInCommand &&
          offsetOfMousePointerInCommand < helpItem.end,
      )

      return { helpHTML: match && match.helpHTML }
    }
  }

  /**
   * Find all the locations where something named name has been defined.
   */
  public findReferences(name: string): LSP.Location[] {
    const uris = Object.keys(this.uriToTreeSitterTrees)
    return flattenArray(uris.map((uri) => this.findOccurrences(uri, name)))
  }

  /**
   * Find all occurrences of name in the given file.
   * It's currently not scope-aware.
   */
  public findOccurrences(uri: string, query: string): LSP.Location[] {
    const tree = this.uriToTreeSitterTrees[uri]
    const contents = this.uriToFileContent[uri]

    const locations: LSP.Location[] = []

    TreeSitterUtil.forEach(tree.rootNode, (n) => {
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
    uri,
    word,
  }: {
    exactMatch: boolean
    uri: string
    word: string
  }): LSP.SymbolInformation[] {
    const fileDeclarations = this.getReachableUriToDeclarations({ uri })

    return Object.keys(fileDeclarations).reduce((symbols, uri) => {
      const declarationsInFile = fileDeclarations[uri]
      Object.keys(declarationsInFile).map((name) => {
        const match = exactMatch ? name === word : name.startsWith(word)
        if (match) {
          declarationsInFile[name].forEach((symbol) => symbols.push(symbol))
        }
      })

      return symbols
    }, [] as LSP.SymbolInformation[])
  }

  /**
   * Analyze the given document, cache the tree-sitter AST, and iterate over the
   * tree to find declarations.
   *
   * Returns all, if any, syntax errors that occurred while parsing the file.
   *
   */
  public analyze({
    document,
    uri, // NOTE: we don't use document.uri to make testing easier
  }: {
    document: TextDocument
    uri: string
  }): LSP.Diagnostic[] {
    const contents = document.getText()

    const tree = this.parser.parse(contents)

    // TODO: would be nicer to save one map from uri to object containing all
    // these fields.
    this.uriToTextDocument[uri] = document
    this.uriToTreeSitterTrees[uri] = tree
    this.uriToDeclarations[uri] = {}
    this.uriToFileContent[uri] = contents
    this.uriToSourcedUris[uri] = sourcing.getSourcedUris({
      fileContent: contents,
      fileUri: uri,
      rootPath: this.workspaceFolder,
      tree,
    })

    const problems: LSP.Diagnostic[] = []

    // TODO: move this somewhere
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

        const word = contents.slice(named.startIndex, named.endIndex)
        const namedDeclarations = this.uriToDeclarations[uri][word] || []

        const parent = TreeSitterUtil.findParent(
          n,
          (p) => p.type === 'function_definition',
        )
        const parentName =
          parent && parent.firstNamedChild
            ? contents.slice(
                parent.firstNamedChild.startIndex,
                parent.firstNamedChild.endIndex,
              )
            : '' // TODO: unsure what we should do here?

        namedDeclarations.push(
          LSP.SymbolInformation.create(
            word,
            this.treeSitterTypeToLSPKind[n.type],
            TreeSitterUtil.range(n),
            uri,
            parentName,
          ),
        )
        this.uriToDeclarations[uri][word] = namedDeclarations
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

  public findAllSourcedUris({ uri }: { uri: string }): Set<string> {
    const allSourcedUris = new Set<string>([])

    const addSourcedFilesFromUri = (fromUri: string) => {
      const sourcedUris = this.uriToSourcedUris[fromUri]

      if (!sourcedUris) {
        return
      }

      sourcedUris.forEach((sourcedUri) => {
        if (!allSourcedUris.has(sourcedUri)) {
          allSourcedUris.add(sourcedUri)
          addSourcedFilesFromUri(sourcedUri)
        }
      })
    }

    addSourcedFilesFromUri(uri)

    return allSourcedUris
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

    if (!document?.rootNode) {
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
      const commentRegExp = /^\s*#\s?(.*)/g
      const matches = commentRegExp.exec(l)
      return matches ? matches[1].trimRight() : null
    }

    let currentLine = doc.getText({
      start: { line: commentBlockIndex, character: 0 },
      end: { line: commentBlockIndex + 1, character: 0 },
    })

    // iterate on every line above and including
    // the current line until getComment returns null
    let currentComment: string | null = ''
    while ((currentComment = getComment(currentLine)) !== null) {
      commentBlock.push(currentComment)
      commentBlockIndex -= 1
      currentLine = doc.getText({
        start: { line: commentBlockIndex, character: 0 },
        end: { line: commentBlockIndex + 1, character: 0 },
      })
    }

    if (commentBlock.length) {
      commentBlock.push('```txt')
      // since we searched from bottom up, we then reverse
      // the lines so that it reads top down.
      commentBlock.reverse()
      commentBlock.push('```')
      return commentBlock.join('\n')
    }

    // no comments found above line:
    return null
  }

  public getAllVariableSymbols({ uri }: { uri: string }): LSP.SymbolInformation[] {
    return this.getAllSymbols({ uri }).filter(
      (symbol) => symbol.kind === LSP.SymbolKind.Variable,
    )
  }

  public setIncludeAllWorkspaceSymbols(includeAllWorkspaceSymbols: boolean): void {
    this.includeAllWorkspaceSymbols = includeAllWorkspaceSymbols
  }

  private getReachableUriToDeclarations({
    uri: fromUri,
  }: { uri?: string } = {}): FileDeclarations {
    if (!fromUri || this.includeAllWorkspaceSymbols) {
      return this.uriToDeclarations
    }

    const uris = [fromUri, ...Array.from(this.findAllSourcedUris({ uri: fromUri }))]

    // for each uri (sourced and base file) we find the declarations
    return uris.reduce((fileDeclarations, uri) => {
      if (!this.uriToDeclarations[uri]) {
        // Either the background analysis didn't run or the file is outside
        // the workspace. Let us try to analyze the file.
        try {
          const fileContent = fs.readFileSync(new URL(uri), 'utf8')
          this.analyze({
            document: TextDocument.create(uri, 'shell', 1, fileContent),
            uri,
          })
        } catch (err) {
          this.console.log(`Error while analyzing sourced file ${uri}: ${err}`)
        }
      }

      fileDeclarations[uri] = this.uriToDeclarations[uri] || {}
      return fileDeclarations
    }, {} as FileDeclarations)
  }

  private getAllSymbols({ uri }: { uri?: string } = {}): LSP.SymbolInformation[] {
    const fileDeclarations = this.getReachableUriToDeclarations({ uri })

    return Object.keys(fileDeclarations).reduce((symbols, uri) => {
      const declarationsInFile = fileDeclarations[uri]
      Object.keys(declarationsInFile).forEach((name) => {
        const declarationNames = this.uriToDeclarations[uri][name] || []
        declarationNames.forEach((d) => symbols.push(d))
      })

      return symbols
    }, [] as LSP.SymbolInformation[])
  }
}
