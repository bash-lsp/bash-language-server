import FIXTURES from '../../../testing/fixtures'
//import { BashFile } from '../bash-file/treesitter-bash-file'
import { BashFile } from '../bash-file/mvdan-bash-file'
import { initializeParser } from '../parser'

let parser: any

const CURRENT_URI = 'dummy-uri.sh'

beforeAll(async () => {
  parser = await initializeParser()
})

describe('bash-file parsing', () => {
  it('returns an empty list of errors for a file with no parsing errors', () => {
    const bashFile = BashFile.parse({
      uri: CURRENT_URI,
      contents: FIXTURES.INSTALL.getText(),
      parser,
    })
    expect(bashFile.problems).toEqual([])
  })

  it('returns a list of errors for a file with a missing node', () => {
    const bashFile = BashFile.parse({
      uri: CURRENT_URI,
      contents: FIXTURES.MISSING_NODE.getText(),
      parser,
    })
    expect(bashFile.problems).not.toEqual([])
  })

  it('creates declarations', () => {
    const bashFile = BashFile.parse({
      uri: CURRENT_URI,
      contents: FIXTURES.ISSUE101.getText(),
      parser,
    })
    expect(bashFile.declarations).toMatchSnapshot()
  })
})

describe('findOccurrences', () => {
  it('returns empty list if parameter is not found', () => {
    const bashFile = BashFile.parse({
      uri: CURRENT_URI,
      contents: FIXTURES.INSTALL.getText(),
      parser,
    })
    const result = bashFile.findOccurrences(CURRENT_URI, 'foobar')
    expect(result).toEqual([])
  })

  it('returns a list of locations if parameter is found', () => {
    const bashFile = BashFile.parse({
      uri: CURRENT_URI,
      contents: FIXTURES.INSTALL.getText(),
      parser,
    })
    const result = bashFile.findOccurrences(CURRENT_URI, 'node_version')
    expect(result).not.toEqual([])
    expect(result).toMatchSnapshot()
  })
})

describe('wordAtPoint', () => {
  it('returns current word at a given point', () => {
    const bashFile = BashFile.parse({
      uri: CURRENT_URI,
      contents: FIXTURES.INSTALL.getText(),
      parser,
    })
    expect(bashFile.wordAtPoint(25, 0)).toEqual(null)
    expect(bashFile.wordAtPoint(25, 1)).toEqual(null)
    expect(bashFile.wordAtPoint(25, 2)).toEqual(null)
    expect(bashFile.wordAtPoint(25, 3)).toEqual(null)
    expect(bashFile.wordAtPoint(25, 4)).toEqual('rm')
    expect(bashFile.wordAtPoint(25, 5)).toEqual('rm')
    expect(bashFile.wordAtPoint(25, 6)).toEqual(null)
    expect(bashFile.wordAtPoint(25, 7)).toEqual('npm-install-')

    expect(bashFile.wordAtPoint(24, 2)).toEqual('else')
    expect(bashFile.wordAtPoint(24, 3)).toEqual('else')
    expect(bashFile.wordAtPoint(24, 5)).toEqual('else')
    expect(bashFile.wordAtPoint(24, 7)).toEqual(null)

    expect(bashFile.wordAtPoint(30, 1)).toEqual(null)

    expect(bashFile.wordAtPoint(30, 2)).toEqual('ret')
    expect(bashFile.wordAtPoint(30, 3)).toEqual('ret')
    expect(bashFile.wordAtPoint(30, 4)).toEqual('ret')
    expect(bashFile.wordAtPoint(30, 5)).toEqual('=')

    expect(bashFile.wordAtPoint(38, 5)).toEqual('configures')
  })
})

describe('commandNameAtPoint', () => {
  it('returns current command name at a given point', () => {
    const bashFile = BashFile.parse({
      uri: CURRENT_URI,
      contents: FIXTURES.INSTALL.getText(),
      parser,
    })
    expect(bashFile.commandNameAtPoint(15, 0)).toEqual(null)

    expect(bashFile.commandNameAtPoint(20, 2)).toEqual('curl')
    expect(bashFile.commandNameAtPoint(20, 15)).toEqual('curl')
    expect(bashFile.commandNameAtPoint(20, 19)).toEqual('curl')

    expect(bashFile.commandNameAtPoint(26, 4)).toEqual('echo')
    expect(bashFile.commandNameAtPoint(26, 9)).toEqual('echo')

    expect(bashFile.commandNameAtPoint(38, 13)).toEqual('env')
    expect(bashFile.commandNameAtPoint(38, 24)).toEqual('grep')
    expect(bashFile.commandNameAtPoint(38, 44)).toEqual('sed')
  })
})
