import { pathToFileURL } from 'node:url'

import {
  FIXTURE_DOCUMENT,
  FIXTURE_FOLDER,
  FIXTURE_URI,
  REPO_ROOT_FOLDER,
} from '../../../testing/fixtures'
import { getMockConnection } from '../../../testing/mocks'
import Analyzer from '../analyser'
import { getDefaultConfiguration } from '../config'
import { initializeParser } from '../parser'
import * as fsUtil from '../util/fs'

let analyzer: Analyzer

const CURRENT_URI = 'dummy-uri.sh'
const mockConsole = getMockConnection().console

// if you add a .sh file to testing/fixtures, update this value
const FIXTURE_FILES_MATCHING_GLOB = 13

const defaultConfig = getDefaultConfiguration()

beforeAll(async () => {
  const parser = await initializeParser()
  analyzer = new Analyzer({
    console: mockConsole,
    parser,
    workspaceFolder: FIXTURE_FOLDER,
  })
})

describe('analyze', () => {
  it('returns an empty list of errors for a file with no parsing errors', () => {
    const result = analyzer.analyze({
      uri: CURRENT_URI,
      document: FIXTURE_DOCUMENT.INSTALL,
    })
    expect(result).toEqual([])
  })

  it('returns a list of errors for a file with a missing node', () => {
    const result = analyzer.analyze({
      uri: CURRENT_URI,
      document: FIXTURE_DOCUMENT.MISSING_NODE,
    })
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })

  it('returns a list of errors for a file with parsing errors', () => {
    const result = analyzer.analyze({
      uri: CURRENT_URI,
      document: FIXTURE_DOCUMENT.PARSE_PROBLEMS,
    })
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findDefinition', () => {
  it('returns an empty list if word is not found', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.findDefinition({ uri: CURRENT_URI, word: 'foobar' })
    expect(result).toEqual([])
  })

  it('returns a location to a file if word is the path in a sourcing statement', () => {
    const document = FIXTURE_DOCUMENT.SOURCING
    const { uri } = document
    analyzer.analyze({ uri, document })
    const result = analyzer.findDefinition({
      uri,
      word: './extension.inc',
      position: { character: 10, line: 2 },
    })
    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "range": Object {
            "end": Object {
              "character": 0,
              "line": 0,
            },
            "start": Object {
              "character": 0,
              "line": 0,
            },
          },
          "uri": "file://${FIXTURE_FOLDER}extension.inc",
        },
      ]
    `)
  })

  it('returns a location to a file if word is the path in a sourcing statement (resolved by using the workspacePath)', async () => {
    const document = FIXTURE_DOCUMENT.SOURCING
    const { uri } = document

    const parser = await initializeParser()
    const connection = getMockConnection()
    const newAnalyzer = new Analyzer({
      console: connection.console,
      parser,
      workspaceFolder: REPO_ROOT_FOLDER,
    })

    newAnalyzer.analyze({ uri, document })
    const result = newAnalyzer.findDefinition({
      uri,
      word: './scripts/tag-release.inc',
      position: { character: 10, line: 16 },
    })
    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "range": Object {
            "end": Object {
              "character": 0,
              "line": 0,
            },
            "start": Object {
              "character": 0,
              "line": 0,
            },
          },
          "uri": "file://${REPO_ROOT_FOLDER}/scripts/tag-release.inc",
        },
      ]
    `)
  })

  it('returns a list of locations if parameter is found', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.findDefinition({
      uri: CURRENT_URI,
      word: 'node_version',
    })
    expect(result).not.toEqual([])
    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "range": Object {
            "end": Object {
              "character": 37,
              "line": 148,
            },
            "start": Object {
              "character": 0,
              "line": 148,
            },
          },
          "uri": "dummy-uri.sh",
        },
      ]
    `)
  })
})

describe('findReferences', () => {
  it('returns empty list if parameter is not found', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.findReferences('foobar')
    expect(result).toEqual([])
  })

  it('returns a list of locations if parameter is found', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.findReferences('node_version')
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findSymbolsForFile', () => {
  it('returns empty list if uri is not found', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.findSymbolsForFile({ uri: 'foobar.sh' })
    expect(result).toEqual([])
  })

  it('returns a list of SymbolInformation if uri is found', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.INSTALL })
    const result = analyzer.findSymbolsForFile({ uri: CURRENT_URI })
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })

  it('issue 101', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.ISSUE101 })
    const result = analyzer.findSymbolsForFile({ uri: CURRENT_URI })
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findAllSourcedUris', () => {
  it('returns references to sourced files', async () => {
    const parser = await initializeParser()
    const connection = getMockConnection()

    const newAnalyzer = new Analyzer({
      console: connection.console,
      parser,
      workspaceFolder: pathToFileURL(REPO_ROOT_FOLDER).href,
    })
    await newAnalyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: defaultConfig.backgroundAnalysisMaxFiles,
      globPattern: defaultConfig.globPattern,
    })

    const result = newAnalyzer.findAllSourcedUris({ uri: FIXTURE_URI.SOURCING })
    expect(result).toEqual(
      new Set([
        `file://${REPO_ROOT_FOLDER}/scripts/tag-release.inc`, // resolved based on repoRootFolder
        `file://${FIXTURE_FOLDER}issue101.sh`, // resolved based on current file
        `file://${FIXTURE_FOLDER}extension.inc`, // resolved based on current file
      ]),
    )
  })

  it('returns references to sourced files without file extension', async () => {
    const parser = await initializeParser()
    const connection = getMockConnection()

    const newAnalyzer = new Analyzer({
      console: connection.console,
      parser,
      workspaceFolder: FIXTURE_FOLDER,
    })
    await newAnalyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: defaultConfig.backgroundAnalysisMaxFiles,
      globPattern: defaultConfig.globPattern,
    })

    // Parse the file without extension
    newAnalyzer.analyze({
      uri: FIXTURE_URI.MISSING_EXTENSION,
      document: FIXTURE_DOCUMENT.MISSING_EXTENSION,
    })

    const result = newAnalyzer.findAllSourcedUris({ uri: FIXTURE_URI.MISSING_EXTENSION })
    expect(result).toEqual(
      new Set([
        `file://${FIXTURE_FOLDER}extension.inc`,
        `file://${FIXTURE_FOLDER}issue101.sh`,
        `file://${FIXTURE_FOLDER}sourcing.sh`,
      ]),
    )
  })
})

describe('wordAtPoint', () => {
  it('returns current word at a given point', () => {
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
  it('returns current command name at a given point', () => {
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

describe('findSymbolsMatchingWord', () => {
  it('return a list of symbols across the workspace when includeAllWorkspaceSymbols is true', async () => {
    const parser = await initializeParser()
    const connection = getMockConnection()

    const analyzer = new Analyzer({
      console: connection.console,
      parser,
      includeAllWorkspaceSymbols: true,
      workspaceFolder: FIXTURE_FOLDER,
    })
    await analyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: defaultConfig.backgroundAnalysisMaxFiles,
      globPattern: defaultConfig.globPattern,
    })

    expect(
      analyzer.findSymbolsMatchingWord({
        word: 'npm_config_logl',
        uri: FIXTURE_URI.INSTALL,
        exactMatch: false,
      }),
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 27,
                "line": 40,
              },
              "start": Object {
                "character": 0,
                "line": 40,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}install.sh",
          },
          "name": "npm_config_loglevel",
        },
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 31,
                "line": 48,
              },
              "start": Object {
                "character": 2,
                "line": 48,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}install.sh",
          },
          "name": "npm_config_loglevel",
        },
      ]
    `)

    expect(
      analyzer.findSymbolsMatchingWord({
        word: 'xxxxxxxx',
        uri: FIXTURE_URI.INSTALL,
        exactMatch: false,
      }),
    ).toMatchInlineSnapshot(`Array []`)

    expect(
      analyzer.findSymbolsMatchingWord({
        word: 'BLU',
        uri: FIXTURE_URI.INSTALL,
        exactMatch: false,
      }),
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 19,
                "line": 6,
              },
              "start": Object {
                "character": 0,
                "line": 6,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}extension.inc",
          },
          "name": "BLUE",
        },
      ]
    `)

    expect(
      analyzer.findSymbolsMatchingWord({
        word: 'BLU',
        uri: FIXTURE_URI.SOURCING,
        exactMatch: false,
      }),
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 19,
                "line": 6,
              },
              "start": Object {
                "character": 0,
                "line": 6,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}extension.inc",
          },
          "name": "BLUE",
        },
      ]
    `)
  })

  it('return a list of symbols accessible to the uri when includeAllWorkspaceSymbols is false', async () => {
    const parser = await initializeParser()
    const connection = getMockConnection()

    const analyzer = new Analyzer({
      console: connection.console,
      parser,
      includeAllWorkspaceSymbols: false,
      workspaceFolder: FIXTURE_FOLDER,
    })
    await analyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: defaultConfig.backgroundAnalysisMaxFiles,
      globPattern: defaultConfig.globPattern,
    })

    expect(
      analyzer.findSymbolsMatchingWord({
        word: 'BLU',
        uri: FIXTURE_URI.INSTALL,
        exactMatch: false,
      }),
    ).toMatchInlineSnapshot(`Array []`)

    expect(
      analyzer.findSymbolsMatchingWord({
        word: 'BLU',
        uri: FIXTURE_URI.SOURCING,
        exactMatch: false,
      }),
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 19,
                "line": 6,
              },
              "start": Object {
                "character": 0,
                "line": 6,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}extension.inc",
          },
          "name": "BLUE",
        },
      ]
    `)
  })
})

describe('commentsAbove', () => {
  it('returns a string of a comment block above a line', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 22)).toEqual(
      '```txt\ndoc for func_one\n```',
    )
  })

  it('handles line breaks in comments', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 28)).toEqual(
      '```txt\ndoc for func_two\nhas two lines\n```',
    )
  })

  it('only returns connected comments', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 36)).toEqual(
      '```txt\ndoc for func_three\n```',
    )
  })

  it('returns null if no comment found', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 45)).toEqual(null)
  })

  it('works for variables', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 42)).toEqual(
      '```txt\nworks for variables\n```',
    )
  })

  it('returns connected comments with empty comment line', () => {
    analyzer.analyze({ uri: CURRENT_URI, document: FIXTURE_DOCUMENT.COMMENT_DOC })
    expect(analyzer.commentsAbove(CURRENT_URI, 51)).toEqual(
      '```txt\nthis is also included\n\ndoc for func_four\n```',
    )
  })
})

describe('initiateBackgroundAnalysis', () => {
  it('finds bash files', async () => {
    const parser = await initializeParser()

    jest.spyOn(Date, 'now').mockImplementation(() => 0)

    const connection = getMockConnection()

    const newAnalyzer = new Analyzer({
      console: connection.console,
      parser,
      workspaceFolder: FIXTURE_FOLDER,
    })
    const { filesParsed } = await newAnalyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: defaultConfig.backgroundAnalysisMaxFiles,
      globPattern: defaultConfig.globPattern,
    })

    expect(connection.window.showWarningMessage).not.toHaveBeenCalled()
    expect(connection.console.warn).not.toHaveBeenCalled()

    // Intro, stats on glob, one file skipped due to shebang, and outro
    expect(filesParsed).toEqual(FIXTURE_FILES_MATCHING_GLOB)

    expect(connection.console.log).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('BackgroundAnalysis: resolving glob'),
    )
  })

  it('handles glob errors', async () => {
    jest
      .spyOn(fsUtil, 'getFilePaths')
      .mockImplementation(() => Promise.reject(new Error('BOOM')))

    const parser = await initializeParser()

    const connection = getMockConnection()

    const newAnalyzer = new Analyzer({
      console: connection.console,
      parser,
      workspaceFolder: FIXTURE_FOLDER,
    })
    const { filesParsed } = await newAnalyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: defaultConfig.backgroundAnalysisMaxFiles,
      globPattern: defaultConfig.globPattern,
    })

    expect(connection.window.showWarningMessage).not.toHaveBeenCalled()
    expect(connection.console.warn).toHaveBeenCalledWith(expect.stringContaining('BOOM'))
    expect(filesParsed).toEqual(0)
  })

  it('allows skipping the analysis', async () => {
    const parser = await initializeParser()

    jest.spyOn(Date, 'now').mockImplementation(() => 0)

    const connection = getMockConnection()

    const newAnalyzer = new Analyzer({
      console: connection.console,
      parser,
      workspaceFolder: FIXTURE_FOLDER,
    })
    const { filesParsed } = await newAnalyzer.initiateBackgroundAnalysis({
      backgroundAnalysisMaxFiles: 0,
      globPattern: defaultConfig.globPattern,
    })

    expect(connection.window.showWarningMessage).not.toHaveBeenCalled()
    expect(connection.console.warn).not.toHaveBeenCalled()

    expect(filesParsed).toEqual(0)
  })
})

describe('getAllVariableSymbols', () => {
  it('returns all variable symbols', async () => {
    const document = FIXTURE_DOCUMENT.SOURCING
    const { uri } = document

    const parser = await initializeParser()
    const connection = getMockConnection()

    const newAnalyzer = new Analyzer({
      console: connection.console,
      parser,
      workspaceFolder: REPO_ROOT_FOLDER,
    })
    // NOTE: no background analysis

    newAnalyzer.analyze({ uri, document })

    expect(newAnalyzer.getAllVariableSymbols({ uri })).toMatchInlineSnapshot(`
      Array [
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 16,
                "line": 10,
              },
              "start": Object {
                "character": 0,
                "line": 10,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}sourcing.sh",
          },
          "name": "BOLD",
        },
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 18,
                "line": 4,
              },
              "start": Object {
                "character": 0,
                "line": 4,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}extension.inc",
          },
          "name": "RED",
        },
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 20,
                "line": 5,
              },
              "start": Object {
                "character": 0,
                "line": 5,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}extension.inc",
          },
          "name": "GREEN",
        },
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 19,
                "line": 6,
              },
              "start": Object {
                "character": 0,
                "line": 6,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}extension.inc",
          },
          "name": "BLUE",
        },
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 16,
                "line": 7,
              },
              "start": Object {
                "character": 0,
                "line": 7,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}extension.inc",
          },
          "name": "BOLD",
        },
        Object {
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 17,
                "line": 8,
              },
              "start": Object {
                "character": 0,
                "line": 8,
              },
            },
            "uri": "file://${FIXTURE_FOLDER}extension.inc",
          },
          "name": "RESET",
        },
        Object {
          "containerName": "tagRelease",
          "kind": 13,
          "location": Object {
            "range": Object {
              "end": Object {
                "character": 8,
                "line": 5,
              },
              "start": Object {
                "character": 2,
                "line": 5,
              },
            },
            "uri": "file://${REPO_ROOT_FOLDER}/scripts/tag-release.inc",
          },
          "name": "tag",
        },
      ]
    `)
  })
})
