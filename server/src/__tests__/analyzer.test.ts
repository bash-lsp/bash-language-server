import FIXTURES, { FIXTURE_FOLDER } from '../../../testing/fixtures'
import Analyzer from '../analyser'
import { initializeParser } from '../parser'

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

describe('findSymbols', () => {
  it('returns empty list if uri is not found', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    const result = analyzer.findSymbols('foobar.sh')
    expect(result).toEqual([])
  })

  it('returns a list of SymbolInformation if uri is found', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    const result = analyzer.findSymbols(CURRENT_URI)
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })

  it('issue 101', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.ISSUE101)
    const result = analyzer.findSymbols(CURRENT_URI)
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('wordAtPoint', () => {
  it('returns current word at a given point', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 5)).toEqual('rm')
    // FIXME: seems like there is an issue here:
    // expect(analyzer.wordAtPoint(CURRENT_URI, 24, 4)).toEqual('else')
  })
})

describe('findSymbolCompletions', () => {
  it('return a list of symbols', () => {
    analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    expect(analyzer.findSymbolCompletions(CURRENT_URI)).toMatchSnapshot()
  })
})

describe('fromRoot', () => {
  it('initializes an analyzer from a root', async () => {
    const parser = await initializeParser()

    jest.spyOn(Date, 'now').mockImplementation(() => 0)

    const connection: any = {
      console: {
        log: jest.fn(),
      },
    }

    const newAnalyzer = await Analyzer.fromRoot({
      connection,
      rootPath: FIXTURE_FOLDER,
      parser,
    })

    expect(newAnalyzer).toBeDefined()

    const FIXTURE_FILES_MATCHING_GLOB = 8
    const LOG_LINES = FIXTURE_FILES_MATCHING_GLOB + 2

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
})
