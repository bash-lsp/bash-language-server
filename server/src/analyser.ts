import * as fs from 'fs'
import * as FuzzySearch from 'fuzzy-search'
import fetch from 'node-fetch'
import * as URI from 'urijs'
import * as url from 'url'
import { promisify } from 'util'
import * as LSP from 'vscode-languageserver'
import * as Parser from 'web-tree-sitter'

import * as config from './config'
import { flattenArray, flattenObjectValues } from './util/flatten'
import { getFilePaths } from './util/fs'
import { getShebang, isBashShebang } from './util/shebang'
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

  private uriToTextDocument: { [uri: string]: LSP.TextDocument } = {}

  private uriToTreeSitterTrees: Trees = {}

  // We need this to find the word at a given point etc.
  private uriToFileContent: Texts = {}

  private uriToDeclarations: FileDeclarations = {}

  private treeSitterTypeToLSPKind: Kinds = {
    // These keys are using underscores as that's the naming convention in tree-sitter.
    environment_variable_assignment: LSP.SymbolKind.Variable,
    function_definition: LSP.SymbolKind.Function,
    variable_assignment: LSP.SymbolKind.Variable,
  }

  public constructor({
    console,
    parser,
  }: {
    console: LSP.RemoteConsole
    parser: Parser
  }) {
    this.parser = parser
    this.console = console
  }

  /**
   * Initiates a background analysis of the files in the given rootPath to
   * enable features across files.
   */
  public async initiateBackgroundAnalysis({
    rootPath,
  }: {
    rootPath: string
  }): Promise<{ filesParsed: number }> {
    const globPattern = config.getGlobPattern()
    const backgroundAnalysisMaxFiles = config.getBackgroundAnalysisMaxFiles()
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
        const shebang = getShebang(fileContent)
        if (shebang && !isBashShebang(shebang)) {
          this.console.log(
            `BackgroundAnalysis: Skipping file ${uri} with shebang "${shebang}"`,
          )
          continue
        }

        this.analyze(uri, LSP.TextDocument.create(uri, 'shell', 1, fileContent))
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
  public findDefinition({ word }: { word: string }): LSP.Location[] {
    const symbols: LSP.SymbolInformation[] = []
    Object.keys(this.uriToDeclarations).forEach((uri) => {
      const declarationNames = this.uriToDeclarations[uri][word] || []
      declarationNames.forEach((d) => symbols.push(d))
    })
    return symbols.map((s) => s.location)
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
   *
   * TODO: if a file is not included we probably shouldn't include it declarations from it.
   */
  public findSymbolsMatchingWord({
    exactMatch,
    word,
  }: {
    exactMatch: boolean
    word: string
  }): LSP.SymbolInformation[] {
    const symbols: LSP.SymbolInformation[] = []

    Object.keys(this.uriToDeclarations).forEach((uri) => {
      const declarationsInFile = this.uriToDeclarations[uri] || {}
      Object.keys(declarationsInFile).map((name) => {
        const match = exactMatch ? name === word : name.startsWith(word)
        if (match) {
          declarationsInFile[name].forEach((symbol) => symbols.push(symbol))
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

  public getAllVariableSymbols(): LSP.SymbolInformation[] {
    return this.getAllSymbols().filter(
      (symbol) => symbol.kind === LSP.SymbolKind.Variable,
    )
  }

  private getAllSymbols(): LSP.SymbolInformation[] {
    // NOTE: this could be cached, it takes < 1 ms to generate for a project with 250 bash files...
    const symbols: LSP.SymbolInformation[] = []

    Object.keys(this.uriToDeclarations).forEach((uri) => {
      Object.keys(this.uriToDeclarations[uri]).forEach((name) => {
        const declarationNames = this.uriToDeclarations[uri][name] || []
        declarationNames.forEach((d) => symbols.push(d))
      })
    })

    return symbols
  }
}
