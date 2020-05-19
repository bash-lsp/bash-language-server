import FIXTURES, { FIXTURE_FOLDER } from '../../../testing/fixtures'
import { getMockConnection } from '../../../testing/mocks'
import Analyzer from '../analyser'
import { initializeParser } from '../parser'
import * as fsUtil from '../util/fs'

let analyzer: Analyzer

const CURRENT_URI = 'dummy-uri.sh'

beforeAll(async () => {
  const parser = await initializeParser()
  analyzer = new Analyzer(parser)
})

describe('analyze', () => {
  it('returns an empty list of errors for a file with no parsing errors', () => {
    const result = analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    expect(result).toEqual([])
  })

  it('returns a list of errors for a file with a missing node', () => {
    const result = analyzer.analyze(CURRENT_URI, FIXTURES.MISSING_NODE)
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })

  it('returns a list of errors for a file with parsing errors', () => {
    const result = analyzer.analyze(CURRENT_URI, FIXTURES.PARSE_PROBLEMS)
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findDefinition', () => {
  it('returns empty list if parameter is not found', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    const result = analyzer.findDefinition('foobar')
    expect(result).toEqual([])
  })

  it('returns a list of locations if parameter is found', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    const result = analyzer.findDefinition('node_version')
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findReferences', () => {
  it('returns empty list if parameter is not found', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    const result = analyzer.findReferences('foobar')
    expect(result).toEqual([])
  })

  it('returns a list of locations if parameter is found', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    const result = analyzer.findReferences('node_version')
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findSymbolsForFile', () => {
  it('returns empty list if uri is not found', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    const result = analyzer.findSymbolsForFile({ uri: 'foobar.sh' })
    expect(result).toEqual([])
  })

  it('returns a list of SymbolInformation if uri is found', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    const result = analyzer.findSymbolsForFile({ uri: CURRENT_URI })
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })

  it('issue 101', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.ISSUE101)
    const result = analyzer.findSymbolsForFile({ uri: CURRENT_URI })
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('wordAtPoint', () => {
  it('returns current word at a given point', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
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

describe('findSymbolCompletions', () => {
  it('return a list of symbols across the workspace', () => {
    analyzer.analyze('install.sh', FIXTURES.INSTALL)
    analyzer.analyze('sourcing-sh', FIXTURES.SOURCING)

    expect(
      analyzer.findSymbolsMatchingWord({ word: 'npm_config_logl', exactMatch: false }),
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
            "uri": "dummy-uri.sh",
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
            "uri": "dummy-uri.sh",
          },
          "name": "npm_config_loglevel",
        },
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
            "uri": "install.sh",
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
            "uri": "install.sh",
          },
          "name": "npm_config_loglevel",
        },
      ]
    `)

    expect(
      analyzer.findSymbolsMatchingWord({ word: 'xxxxxxxx', exactMatch: false }),
    ).toMatchInlineSnapshot(`Array []`)

    expect(
      analyzer.findSymbolsMatchingWord({ word: 'BLU', exactMatch: false }),
    ).toMatchInlineSnapshot(`Array []`)
  })
})

describe('commentsAbove', () => {
  it('returns a string of a comment block above a line', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.COMMENT_DOC)
    expect(analyzer.commentsAbove(CURRENT_URI, 22)).toEqual('doc for func_one')
  })

  it('handles line breaks in comments', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.COMMENT_DOC)
    expect(analyzer.commentsAbove(CURRENT_URI, 28)).toEqual(
      'doc for func_two\nhas two lines',
    )
  })

  it('only returns connected comments', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.COMMENT_DOC)
    expect(analyzer.commentsAbove(CURRENT_URI, 36)).toEqual('doc for func_three')
  })

  it('returns null if no comment found', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.COMMENT_DOC)
    expect(analyzer.commentsAbove(CURRENT_URI, 45)).toEqual(null)
  })

  it('works for variables', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.COMMENT_DOC)
    expect(analyzer.commentsAbove(CURRENT_URI, 42)).toEqual('works for variables')
  })
})

describe('fromRoot', () => {
  it('initializes an analyzer from a root', async () => {
    const parser = await initializeParser()

    jest.spyOn(Date, 'now').mockImplementation(() => 0)

    const connection = getMockConnection()

    const newAnalyzer = await Analyzer.fromRoot({
      connection,
      rootPath: FIXTURE_FOLDER,
      parser,
    })

    expect(newAnalyzer).toBeDefined()

    expect(connection.window.showWarningMessage).not.toHaveBeenCalled()

    // if you add a .sh file to testing/fixtures, update this value
    const FIXTURE_FILES_MATCHING_GLOB = 11

    // Intro, stats on glob, one file skipped due to shebang, and outro
    const LOG_LINES = FIXTURE_FILES_MATCHING_GLOB + 4

    expect(connection.console.log).toHaveBeenCalledTimes(LOG_LINES)
    expect(connection.console.log).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Analyzing files matching'),
    )

    expect(connection.console.log).toHaveBeenNthCalledWith(
      LOG_LINES,
      'Analyzer finished after 0 seconds',
    )
  })

  it('handles glob errors', async () => {
    jest
      .spyOn(fsUtil, 'getFilePaths')
      .mockImplementation(() => Promise.reject(new Error('BOOM')))

    const parser = await initializeParser()

    const connection = getMockConnection()

    const newAnalyzer = await Analyzer.fromRoot({
      connection,
      rootPath: FIXTURE_FOLDER,
      parser,
    })

    expect(newAnalyzer).toBeDefined()

    expect(connection.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('BOOM'),
    )
  })
})
