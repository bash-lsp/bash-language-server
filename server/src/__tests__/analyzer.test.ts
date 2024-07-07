import { pathToFileURL } from 'node:url'

import {
  FIXTURE_DOCUMENT,
  FIXTURE_FOLDER,
  FIXTURE_URI,
  REPO_ROOT_FOLDER,
  updateSnapshotUris,
} from '../../../testing/fixtures'
import Analyzer from '../analyser'
import { getDefaultConfiguration } from '../config'
import { initializeParser } from '../parser'
import * as fsUtil from '../util/fs'
import { Logger } from '../util/logger'

const CURRENT_URI = 'dummy-uri.sh'

// if you add a .sh file to testing/fixtures, update this value
const FIXTURE_FILES_MATCHING_GLOB = 19

const defaultConfig = getDefaultConfiguration()

jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {
  // noop
})
const loggerInfo = jest.spyOn(Logger.prototype, 'info')
const loggerWarn = jest.spyOn(Logger.prototype, 'warn')

async function getAnalyzer({
  enableSourceErrorDiagnostics = false,
  includeAllWorkspaceSymbols = false,
  workspaceFolder = FIXTURE_FOLDER,
  runBackgroundAnalysis = false,
}: {
  enableSourceErrorDiagnostics?: boolean
  includeAllWorkspaceSymbols?: boolean
  workspaceFolder?: string
  runBackgroundAnalysis?: boolean
}) {
  const parser = await initializeParser()

  const analyzer = new Analyzer({
    enableSourceErrorDiagnostics,
    parser,
    includeAllWorkspaceSymbols,
    workspaceFolder,
  })
  if (runBackgroundAnalysis) {
    await analyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: defaultConfig.backgroundAnalysisMaxFiles,
      globPattern: defaultConfig.globPattern,
    })
  }
  return analyzer
}

describe('analyze', () => {
  it('returns an empty list of diagnostics for a file with no parsing errors', async () => {
    const analyzer = await getAnalyzer({})
    const diagnostics = analyzer.analyze({
      uri: CURRENT_URI,
      document: FIXTURE_DOCUMENT.INSTALL,
    })
    expect(diagnostics).toEqual([])
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  it('parses files with a missing nodes', async () => {
    const analyzer = await getAnalyzer({})
    const diagnostics = analyzer.analyze({
      uri: CURRENT_URI,
      document: FIXTURE_DOCUMENT.MISSING_NODE,
    })
    expect(diagnostics).toEqual([])
    expect(loggerWarn).toHaveBeenCalledWith(
      'Error while parsing dummy-uri.sh: syntax error',
    )
  })

  it('parses a file with parsing errors', async () => {
    const analyzer = await getAnalyzer({})
    const diagnostics = analyzer.analyze({
      uri: CURRENT_URI,
      document: FIXTURE_DOCUMENT.PARSE_PROBLEMS,
    })
    expect(diagnostics).toEqual([])
    expect(loggerWarn).toHaveBeenCalledWith(
      'Error while parsing dummy-uri.sh: syntax error',
    )
  })

  it('returns a list of diagnostics for a file with sourcing issues', async () => {
    const analyzer = await getAnalyzer({
      enableSourceErrorDiagnostics: true,
      includeAllWorkspaceSymbols: false,
    })
    const diagnostics = analyzer.analyze({
      uri: CURRENT_URI,
      document: FIXTURE_DOCUMENT.SOURCING,
    })
    expect(diagnostics).not.toEqual([])
    expect(diagnostics).toMatchInlineSnapshot(`
      [
        {
          "message": "Source command could not be analyzed: non-constant source not supported.

      Consider adding a ShellCheck directive above this line to fix or ignore this:
      # shellcheck source=/my-file.sh # specify the file to source
      # shellcheck source-path=my_script_folder # specify the folder to search in
      # shellcheck source=/dev/null # to ignore the error

      Disable this message by changing the configuration option "enableSourceErrorDiagnostics"",
          "range": {
            "end": {
              "character": 16,
              "line": 21,
            },
            "start": {
              "character": 2,
              "line": 21,
            },
          },
          "severity": 3,
          "source": "bash-language-server",
        },
      ]
    `)

    // unless setIncludeAllWorkspaceSymbols set
    analyzer.setIncludeAllWorkspaceSymbols(true)
    const diagnostics2 = analyzer.analyze({
      uri: CURRENT_URI,
      document: FIXTURE_DOCUMENT.SOURCING,
    })
    expect(diagnostics2).toEqual([])

    // or if enableSourceErrorDiagnostics is false
    analyzer.setIncludeAllWorkspaceSymbols(false)
    analyzer.setEnableSourceErrorDiagnostics(false)
    const diagnostics3 = analyzer.analyze({
      uri: CURRENT_URI,
      document: FIXTURE_DOCUMENT.SOURCING,
    })
    expect(diagnostics3).toEqual([])
  })

  it('ensures tree-sitter does not crash', async () => {
    // newer version of tree-sitter will crash on this file and never respond
    // to new queries.
    const analyzer = await getAnalyzer({ runBackgroundAnalysis: false })

    // Parse the file
    analyzer.analyze({
      uri: FIXTURE_URI.CRASH,
      document: FIXTURE_DOCUMENT.CRASH,
    })

    const result = analyzer.findAllSourcedUris({ uri: FIXTURE_URI.CRASH })
    expect(result).toEqual(new Set([]))
  })
})

describe('findDeclarationLocations', () => {
  it('returns a location to a file if word is the path in a sourcing statement', async () => {
    const analyzer = await getAnalyzer({})
    const document = FIXTURE_DOCUMENT.SOURCING
    const { uri } = document
    analyzer.analyze({ uri, document })
    const result = analyzer.findDeclarationLocations({
      uri,
      word: './extension.inc',
      position: { character: 10, line: 2 },
    })
    expect(updateSnapshotUris(result)).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 0,
              "line": 0,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
          "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
        },
      ]
    `)
  })

  it('returns a location to a file if word is the path in a sourcing statement (resolved by using the workspacePath)', async () => {
    const document = FIXTURE_DOCUMENT.SOURCING
    const { uri } = document

    const analyzer = await getAnalyzer({ workspaceFolder: REPO_ROOT_FOLDER })

    analyzer.analyze({ uri, document })
    const result = analyzer.findDeclarationLocations({
      uri,
      word: './scripts/tag-release.inc',
      position: { character: 10, line: 16 },
    })
    expect(updateSnapshotUris(result)).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 0,
              "line": 0,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
          "uri": "file://__REPO_ROOT_FOLDER__/scripts/tag-release.inc",
        },
      ]
    `)
  })

  it('returns a local reference if definition is found', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.findDeclarationLocations({
      position: { character: 1, line: 148 },
      uri: CURRENT_URI,
      word: 'node_version',
    })
    expect(updateSnapshotUris(result)).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 37,
              "line": 148,
            },
            "start": {
              "character": 0,
              "line": 148,
            },
          },
          "uri": "dummy-uri.sh",
        },
      ]
    `)
  })

  it('returns local declarations', async () => {
    const analyzer = await getAnalyzer({})
    const result = analyzer.findDeclarationLocations({
      position: { character: 12, line: 12 },
      uri: FIXTURE_URI.SCOPE,
      word: 'X',
    })
    expect(updateSnapshotUris(result)).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 17,
              "line": 12,
            },
            "start": {
              "character": 10,
              "line": 12,
            },
          },
          "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
        },
      ]
    `)
  })

  it('returns local declarations for loop variables', async () => {
    const analyzer = await getAnalyzer({})
    const result = analyzer.findDeclarationLocations({
      position: { character: 18, line: 39 },
      uri: FIXTURE_URI.SCOPE,
      word: 'i',
    })
    expect(updateSnapshotUris(result)).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 5,
              "line": 37,
            },
            "start": {
              "character": 4,
              "line": 37,
            },
          },
          "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
        },
      ]
    `)
  })
})

describe('findReferences', () => {
  it('returns empty list if parameter is not found', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.findReferences('foobar')
    expect(result).toEqual([])
  })

  it('returns a list of locations if parameter is found', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.findReferences('node_version')
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('getDeclarationsForUri', () => {
  it('returns empty list if uri is not found', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.getDeclarationsForUri({ uri: 'foobar.sh' })
    expect(result).toEqual([])
  })

  it('returns a list of SymbolInformation if uri is found', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.getDeclarationsForUri({ uri: CURRENT_URI })
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })

  it('issue 101', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.ISSUE101 })
    const result = analyzer.getDeclarationsForUri({ uri: CURRENT_URI })
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findAllSourcedUris', () => {
  it('returns references to sourced files', async () => {
    const analyzer = await getAnalyzer({
      runBackgroundAnalysis: true,
      workspaceFolder: pathToFileURL(REPO_ROOT_FOLDER).href,
    })

    const result = analyzer.findAllSourcedUris({ uri: FIXTURE_URI.SOURCING })
    expect(result).toEqual(
      new Set([
        `file://${REPO_ROOT_FOLDER}/scripts/tag-release.inc`, // resolved based on repoRootFolder
        `file://${FIXTURE_FOLDER}issue101.sh`, // resolved based on current file
        `file://${FIXTURE_FOLDER}extension.inc`, // resolved based on current file
      ]),
    )
  })

  it('returns references to sourced files without file extension', async () => {
    const analyzer = await getAnalyzer({ runBackgroundAnalysis: true })

    // Parse the file without extension
    analyzer.analyze({
      uri: FIXTURE_URI.MISSING_EXTENSION,
      document: FIXTURE_DOCUMENT.MISSING_EXTENSION,
    })

    const result = analyzer.findAllSourcedUris({ uri: FIXTURE_URI.MISSING_EXTENSION })
    expect(result).toEqual(
      new Set([
        `file://${FIXTURE_FOLDER}extension.inc`,
        `file://${FIXTURE_FOLDER}issue101.sh`,
      ]),
    )
  })
})

describe('wordAtPoint', () => {
  it('returns current word at a given point', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 0)).toEqual(null)
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 1)).toEqual(null)
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 2)).toEqual(null)
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 3)).toEqual(null)
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 4)).toEqual('rm')
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 5)).toEqual('rm')
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 6)).toEqual(null)
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 7)).toEqual('npm-install-')

    expect(analyzer.wordAtPoint(CURRENT_URI, 24, 2)).toEqual('else')
    expect(analyzer.wordAtPoint(CURRENT_URI, 24, 3)).toEqual('else')
    expect(analyzer.wordAtPoint(CURRENT_URI, 24, 5)).toEqual('else')
    expect(analyzer.wordAtPoint(CURRENT_URI, 24, 7)).toEqual(null)

    expect(analyzer.wordAtPoint(CURRENT_URI, 30, 1)).toEqual(null)

    expect(analyzer.wordAtPoint(CURRENT_URI, 30, 2)).toEqual('ret')
    expect(analyzer.wordAtPoint(CURRENT_URI, 30, 3)).toEqual('ret')
    expect(analyzer.wordAtPoint(CURRENT_URI, 30, 4)).toEqual('ret')
    expect(analyzer.wordAtPoint(CURRENT_URI, 30, 5)).toEqual('=')

    expect(analyzer.wordAtPoint(CURRENT_URI, 38, 5)).toEqual('configures')
  })
})

describe('commandNameAtPoint', () => {
  it('returns current command name at a given point', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    expect(analyzer.commandNameAtPoint(CURRENT_URI, 15, 0)).toEqual(null)

    expect(analyzer.commandNameAtPoint(CURRENT_URI, 20, 2)).toEqual('curl')
    expect(analyzer.commandNameAtPoint(CURRENT_URI, 20, 15)).toEqual('curl')
    expect(analyzer.commandNameAtPoint(CURRENT_URI, 20, 19)).toEqual('curl')

    expect(analyzer.commandNameAtPoint(CURRENT_URI, 26, 4)).toEqual('echo')
    expect(analyzer.commandNameAtPoint(CURRENT_URI, 26, 9)).toEqual('echo')

    expect(analyzer.commandNameAtPoint(CURRENT_URI, 38, 13)).toEqual('env')
    expect(analyzer.commandNameAtPoint(CURRENT_URI, 38, 24)).toEqual('grep')
    expect(analyzer.commandNameAtPoint(CURRENT_URI, 38, 44)).toEqual('sed')
  })
})

describe('findDeclarationsMatchingWord', () => {
  it('returns a list of symbols across the workspace when includeAllWorkspaceSymbols is true', async () => {
    const analyzer = await getAnalyzer({
      includeAllWorkspaceSymbols: true,
      runBackgroundAnalysis: true,
    })

    expect(
      updateSnapshotUris(
        analyzer.findDeclarationsMatchingWord({
          word: 'npm_config_logl',
          uri: FIXTURE_URI.INSTALL,
          exactMatch: false,
          position: { line: 1000, character: 0 },
        }),
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 27,
                "line": 40,
              },
              "start": {
                "character": 0,
                "line": 40,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          "name": "npm_config_loglevel",
        },
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 26,
                "line": 97,
              },
              "start": {
                "character": 0,
                "line": 97,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/renaming.sh",
          },
          "name": "npm_config_loglevel",
        },
      ]
    `)

    expect(
      analyzer.findDeclarationsMatchingWord({
        word: 'xxxxxxxx',
        uri: FIXTURE_URI.INSTALL,
        exactMatch: false,
        position: { line: 1000, character: 0 },
      }),
    ).toMatchInlineSnapshot(`[]`)

    expect(
      updateSnapshotUris(
        analyzer.findDeclarationsMatchingWord({
          word: 'BLU',
          uri: FIXTURE_URI.INSTALL,
          exactMatch: false,
          position: { line: 6, character: 9 },
        }),
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 25,
                "line": 6,
              },
              "start": {
                "character": 6,
                "line": 6,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
          "name": "BLUE",
        },
      ]
    `)

    expect(
      updateSnapshotUris(
        analyzer.findDeclarationsMatchingWord({
          word: 'BLU',
          uri: FIXTURE_URI.SOURCING,
          exactMatch: false,
          position: { line: 6, character: 9 },
        }),
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 25,
                "line": 6,
              },
              "start": {
                "character": 6,
                "line": 6,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
          "name": "BLUE",
        },
      ]
    `)
  })

  it('returns a list of symbols accessible to the uri when includeAllWorkspaceSymbols is false', async () => {
    const analyzer = await getAnalyzer({
      includeAllWorkspaceSymbols: false,
      runBackgroundAnalysis: true,
    })

    expect(
      analyzer.findDeclarationsMatchingWord({
        word: 'BLU',
        uri: FIXTURE_URI.INSTALL,
        exactMatch: false,
        position: { line: 1000, character: 0 },
      }),
    ).toMatchInlineSnapshot(`[]`)

    expect(
      updateSnapshotUris(
        analyzer.findDeclarationsMatchingWord({
          word: 'BLU',
          uri: FIXTURE_URI.SOURCING,
          exactMatch: false,
          position: { line: 6, character: 9 },
        }),
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 25,
                "line": 6,
              },
              "start": {
                "character": 6,
                "line": 6,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
          "name": "BLUE",
        },
      ]
    `)
  })

  it('resolves sourced file not covered by the background analysis glob', async () => {
    async function expectThatSourcingWorksWhenIncludeAllWorkspaceSymbolsIs(v: boolean) {
      const analyzer = await getAnalyzer({
        runBackgroundAnalysis: true,
        includeAllWorkspaceSymbols: v,
      })

      expect(
        analyzer.findDeclarationsMatchingWord({
          word: 'XXX',
          uri: FIXTURE_URI.SOURCING2,
          exactMatch: true,
          position: { line: 2, character: 21 }, // XXX
        }),
      ).toHaveLength(1)
    }

    await expectThatSourcingWorksWhenIncludeAllWorkspaceSymbolsIs(false)
    await expectThatSourcingWorksWhenIncludeAllWorkspaceSymbolsIs(true)
  })

  it('returns symbols depending on the scope', async () => {
    const analyzer = await getAnalyzer({
      includeAllWorkspaceSymbols: false,
    })

    const findWordFromLine = (word: string, line: number) =>
      analyzer.findDeclarationsMatchingWord({
        word,
        uri: FIXTURE_URI.SCOPE,
        exactMatch: true,
        position: { line, character: 0 },
      })

    // Variable or function defined yet
    expect(findWordFromLine('X', 0)).toEqual([])
    expect(findWordFromLine('f', 0)).toEqual([])

    // First definition
    expect(updateSnapshotUris(findWordFromLine('X', 3))).toMatchInlineSnapshot(`
      [
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 9,
                "line": 2,
              },
              "start": {
                "character": 0,
                "line": 2,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
          "name": "X",
        },
      ]
    `)

    // Local variable definition
    expect(updateSnapshotUris(findWordFromLine('X', 13))).toMatchInlineSnapshot(`
      [
        {
          "containerName": "g",
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 17,
                "line": 12,
              },
              "start": {
                "character": 10,
                "line": 12,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
          "name": "X",
        },
      ]
    `)

    // Local function definition
    expect(updateSnapshotUris(findWordFromLine('f', 23))).toMatchInlineSnapshot(`
      [
        {
          "containerName": "g",
          "kind": 12,
          "location": {
            "range": {
              "end": {
                "character": 5,
                "line": 21,
              },
              "start": {
                "character": 4,
                "line": 18,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
          "name": "f",
        },
      ]
    `)

    // Last definition
    expect(updateSnapshotUris(findWordFromLine('X', 1000))).toMatchInlineSnapshot(`
      [
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 9,
                "line": 4,
              },
              "start": {
                "character": 0,
                "line": 4,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
          "name": "X",
        },
      ]
    `)

    expect(updateSnapshotUris(findWordFromLine('f', 1000))).toMatchInlineSnapshot(`
      [
        {
          "kind": 12,
          "location": {
            "range": {
              "end": {
                "character": 1,
                "line": 30,
              },
              "start": {
                "character": 0,
                "line": 7,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
          "name": "f",
        },
      ]
    `)

    // Global variable defined inside a function
    expect(updateSnapshotUris(findWordFromLine('GLOBAL_1', 1000))).toMatchInlineSnapshot(`
      [
        {
          "containerName": "g",
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 23,
                "line": 13,
              },
              "start": {
                "character": 4,
                "line": 13,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
          "name": "GLOBAL_1",
        },
      ]
    `)
  })
})

describe('commentsAbove', () => {
  it('returns a string of a comment block above a line', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 22)).toEqual(
      '```txt\ndoc for func_one\n```',
    )
  })

  it('handles line breaks in comments', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 28)).toEqual(
      '```txt\ndoc for func_two\nhas two lines\n```',
    )
  })

  it('only returns connected comments', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 36)).toEqual(
      '```txt\ndoc for func_three\n```',
    )
  })

  it('returns null if no comment found', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 45)).toEqual(null)
  })

  it('works for variables', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 42)).toEqual(
      '```txt\nworks for variables\n```',
    )
  })

  it('returns connected comments with empty comment line', async () => {
    const analyzer = await getAnalyzer({})
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 51)).toEqual(
      '```txt\nthis is also included\n\ndoc for func_four\n```',
    )
  })
})

describe('initiateBackgroundAnalysis', () => {
  it('finds bash files', async () => {
    jest.spyOn(Date, 'now').mockImplementation(() => 0)

    const analyzer = await getAnalyzer({})

    const { filesParsed } = await analyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: defaultConfig.backgroundAnalysisMaxFiles,
      globPattern: defaultConfig.globPattern,
    })

    expect(loggerWarn).toHaveBeenCalled()
    expect(loggerWarn.mock.calls).toEqual([
      [expect.stringContaining('missing-node.sh: syntax error')],
      [expect.stringContaining('not-a-shell-script.sh: syntax error')],
      [expect.stringContaining('parse-problems.sh: syntax error')],
      [expect.stringContaining('sourcing.sh line 16: failed to resolve path')],
      [expect.stringContaining('sourcing.sh line 21: non-constant source not supported')],
    ])

    // Intro, stats on glob, one file skipped due to shebang, and outro
    expect(filesParsed).toEqual(FIXTURE_FILES_MATCHING_GLOB)

    expect(loggerInfo).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('BackgroundAnalysis: resolving glob'),
    )
  })

  it('handles glob errors', async () => {
    jest
      .spyOn(fsUtil, 'getFilePaths')
      .mockImplementation(() => Promise.reject(new Error('BOOM')))

    const analyzer = await getAnalyzer({})

    const { filesParsed } = await analyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: defaultConfig.backgroundAnalysisMaxFiles,
      globPattern: defaultConfig.globPattern,
    })

    expect(loggerWarn).toHaveBeenCalledWith(expect.stringContaining('BOOM'))
    expect(filesParsed).toEqual(0)
  })

  it('allows skipping the analysis', async () => {
    jest.spyOn(Date, 'now').mockImplementation(() => 0)

    const analyzer = await getAnalyzer({})

    const { filesParsed } = await analyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: 0,
      globPattern: defaultConfig.globPattern,
    })

    expect(loggerWarn).not.toHaveBeenCalled()

    expect(filesParsed).toEqual(0)
  })
})

describe('getAllVariables', () => {
  it('returns all variable symbols', async () => {
    const document = FIXTURE_DOCUMENT.SOURCING
    const { uri } = document

    const analyzer = await getAnalyzer({ workspaceFolder: REPO_ROOT_FOLDER })

    // NOTE: no background analysis

    analyzer.analyze({ uri, document })

    expect(
      updateSnapshotUris(
        analyzer.getAllVariables({
          uri,
          position: { line: 20, character: 0 },
        }),
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 16,
                "line": 10,
              },
              "start": {
                "character": 0,
                "line": 10,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/sourcing.sh",
          },
          "name": "BOLD",
        },
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 18,
                "line": 4,
              },
              "start": {
                "character": 0,
                "line": 4,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
          "name": "RED",
        },
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 20,
                "line": 5,
              },
              "start": {
                "character": 0,
                "line": 5,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
          "name": "GREEN",
        },
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 25,
                "line": 6,
              },
              "start": {
                "character": 6,
                "line": 6,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
          "name": "BLUE",
        },
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 23,
                "line": 7,
              },
              "start": {
                "character": 7,
                "line": 7,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
          "name": "BOLD",
        },
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 19,
                "line": 10,
              },
              "start": {
                "character": 2,
                "line": 10,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
          "name": "RESET",
        },
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 14,
                "line": 25,
              },
              "start": {
                "character": 5,
                "line": 25,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
          "name": "FILE_PATH",
        },
      ]
    `)
  })
})
