import FIXTURES from '../../../testing/fixtures'
import { Analyzer } from '../analyser'

const analyzer = new Analyzer()

const CURRENT_URI = 'dummy-uri.sh'
beforeEach(() => {
  analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
})

describe('analyze', () => {
  it('returns an empty list for a file with no errors', () => {
    const result = analyzer.analyze(CURRENT_URI, FIXTURES.INSTALL)
    expect(result).toEqual([])
  })

  it('returns a list of errors for a file with errors', () => {
    const result = analyzer.analyze(CURRENT_URI, FIXTURES.PARSE_PROBLEMS)
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findDefinition', () => {
  it('returns empty list if parameter is not found', () => {
    const result = analyzer.findDefinition('foobar')
    expect(result).toEqual([])
  })

  it('returns a list of locations if parameter is found', () => {
    const result = analyzer.findDefinition('node_version')
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findReferences', () => {
  it('returns empty list if parameter is not found', () => {
    const result = analyzer.findReferences('foobar')
    expect(result).toEqual([])
  })

  it('returns a list of locations if parameter is found', () => {
    const result = analyzer.findReferences('node_version')
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('findSymbols', () => {
  it('returns empty list if uri is not found', () => {
    const result = analyzer.findSymbols('foobar.sh')
    expect(result).toEqual([])
  })

  it('returns a list of SymbolInformation if uri is found', () => {
    const result = analyzer.findSymbols(CURRENT_URI)
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('wordAtPoint', () => {
  it('returns current word at a given point', () => {
    expect(analyzer.wordAtPoint(CURRENT_URI, 25, 5)).toEqual('rm')
    // FIXME: seems like there is an issue here:
    // expect(analyzer.wordAtPoint(CURRENT_URI, 24, 4)).toEqual('else')
  })
})
