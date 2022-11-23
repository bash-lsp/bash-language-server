import * as fs from 'fs'
import * as FuzzySearch from 'fuzzy-search'
import * as request from 'request-promise-native'
import * as URI from 'urijs'
import * as url from 'url'
import { promisify } from 'util'
import * as LSP from 'vscode-languageserver'
import * as Parser from 'web-tree-sitter'

import { BashFile } from './bash-file/treesitter-bash-file'
import { getGlobPattern } from './config'
import { flattenArray, flattenObjectValues } from './util/flatten'
import { getFilePaths } from './util/fs'
import { getShebang, isBashShebang } from './util/shebang'

const readFileAsync = promisify(fs.readFile)

type Kinds = { [type: string]: LSP.SymbolKind }

type Texts = { [uri: string]: string }
type Declarations = { [name: string]: LSP.SymbolInformation[] }
type FileDeclarations = { [uri: string]: Declarations }
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
        const errorMessage = error instanceof Error ? error.message : error
        connection.window.showWarningMessage(
          `Failed to analyze bash files using the glob "${globPattern}". The experience will be degraded. Error: ${errorMessage}`,
        )
      }

      // TODO: we could load all files without extensions: globPattern: '**/[^.]'

      connection.console.log(
        `Glob resolved with ${filePaths.length} files after ${getTimePassed()}`,
      )

      for (const filePath of filePaths) {
        const uri = url.pathToFileURL(filePath).href
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
          const errorMessage = error instanceof Error ? error.message : error
          connection.console.warn(`Failed analyzing ${uri}. Error: ${errorMessage}`)
        }
      }

      connection.console.log(`Analyzer finished after ${getTimePassed()}`)
    }

    return analyzer
  }

  private parser: Parser

  private uriToTextDocument: { [uri: string]: LSP.TextDocument } = {}
  private uriToDeclarations: FileDeclarations = {}
  private uriToBashFiles: { [uri: string]: BashFile } = {}

  // We need this to find the word at a given point etc.
  private uriToFileContent: Texts = {}

  private treeSitterTypeToLSPKind: Kinds = {
    // These keys are using underscores as that's the naming convention in tree-sitter.
    environment_variable_assignment: LSP.SymbolKind.Variable,
    function_definition: LSP.SymbolKind.Function,
    variable_assignment: LSP.SymbolKind.Variable,
  }

  public constructor(parser: Parser) {
    this.parser = parser
  }

  /**
   * Find all the locations where something named name has been defined.
   */
  public findDefinition(name: string): LSP.Location[] {
    const symbols: LSP.SymbolInformation[] = []
    Object.keys(this.uriToDeclarations).forEach((uri) => {
      const declarationNames = this.uriToDeclarations[uri][name] || []
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
  }): Promise<any> {
    // FIXME: this could likely be using commandNameAtPoint instead!
    const leafNode: any = this.uriToBashFiles[params.textDocument.uri].nodeAtPoint(
      params.position.line,
      params.position.character,
    )

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
      uri: URI(endpoint).path('/api/explain').addQuery('cmd', cmd).toString(),
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
    const uris = Object.keys(this.uriToBashFiles)
    return flattenArray(uris.map((uri) => this.findOccurrences(uri, name)))
  }

  /**
   * Find all occurrences of name in the given file.
   * It's currently not scope-aware.
   */
  public findOccurrences(uri: string, query: string): LSP.Location[] {
    return this.uriToBashFiles[uri].findOccurrences(uri, query)
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

    const bashFile = BashFile.parse({ contents, uri, parser: this.parser })

    this.uriToTextDocument[uri] = document
    this.uriToBashFiles[uri] = bashFile
    this.uriToDeclarations[uri] = bashFile.declarations
    this.uriToFileContent[uri] = contents

    return bashFile.problems
  }

  /**
   * Find the full word at the given point.
   */
  public wordAtPoint(uri: string, line: number, column: number): string | null {
    return this.uriToBashFiles[uri].wordAtPoint(line, column)
  }

  /**
   * Find the name of the command at the given point.
   */
  public commandNameAtPoint(uri: string, line: number, column: number): string | null {
    return this.uriToBashFiles[uri].commandNameAtPoint(line, column)
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
