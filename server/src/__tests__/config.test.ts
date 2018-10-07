import * as config from '../config'

describe('getExplainshellEndpoint', () => {
  it('default to null', () => {
    process.env = {}
    const result = config.getExplainshellEndpoint()
    expect(result).toBeNull()
  })

  it('parses environment variable', () => {
    process.env = {
      EXPLAINSHELL_ENDPOINT: 'localhost:8080',
    }
    const result = config.getExplainshellEndpoint()
    expect(result).toEqual('localhost:8080')
  })
})

describe('highlightParsingError', () => {
  it('default to true', () => {
    process.env = {}
    const result = config.getHighlightParsingError()
    expect(result).toEqual(true)
  })

  it('parses environment variable', () => {
    process.env = {
      HIGHLIGHT_PARSING_ERRORS: 'true',
    }
    let result = config.getHighlightParsingError()
    expect(result).toEqual(true)

    process.env = {
      HIGHLIGHT_PARSING_ERRORS: 'false',
    }
    result = config.getHighlightParsingError()
    expect(result).toEqual(false)
  })
})
