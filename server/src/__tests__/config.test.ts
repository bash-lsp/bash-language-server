import * as config from '../config'

describe('getShellcheckPath', () => {
  it('defaults to shellcheck without path', () => {
    process.env = {}
    const result = config.getShellcheckPath()
    expect(result).toEqual('shellcheck')
  })

  it('default to null in case of an empty string', () => {
    process.env = {
      SHELLCHECK_PATH: '',
    }
    const result = config.getShellcheckPath()
    expect(result).toBeNull()
  })

  it('parses environment variable', () => {
    process.env = {
      SHELLCHECK_PATH: '/path/to/shellcheck',
    }
    const result = config.getShellcheckPath()
    expect(result).toEqual('/path/to/shellcheck')
  })
})

describe('getExplainshellEndpoint', () => {
  it('default to null', () => {
    process.env = {}
    const result = config.getExplainshellEndpoint()
    expect(result).toBeNull()
  })

  it('default to null in case of an empty string', () => {
    process.env = {
      EXPLAINSHELL_ENDPOINT: '',
    }
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

describe('getGlobPattern', () => {
  it('default to a basic glob', () => {
    process.env = {}
    const result = config.getGlobPattern()
    expect(result).toEqual(config.DEFAULT_GLOB_PATTERN)
  })

  it('default to a basic glob in case of an empty string', () => {
    process.env = {
      GLOB_PATTERN: '',
    }
    const result = config.getGlobPattern()
    expect(result).toEqual(config.DEFAULT_GLOB_PATTERN)
  })

  it('parses environment variable', () => {
    process.env = {
      GLOB_PATTERN: '*.*',
    }
    const result = config.getGlobPattern()
    expect(result).toEqual('*.*')
  })
})

describe('highlightParsingError', () => {
  it('default to false', () => {
    process.env = {}
    const result = config.getHighlightParsingError()
    expect(result).toEqual(false)
  })

  it('parses environment variable', () => {
    process.env = {
      HIGHLIGHT_PARSING_ERRORS: 'true',
    }
    let result = config.getHighlightParsingError()
    expect(result).toEqual(true)

    process.env = {
      HIGHLIGHT_PARSING_ERRORS: '1',
    }
    result = config.getHighlightParsingError()
    expect(result).toEqual(true)

    process.env = {
      HIGHLIGHT_PARSING_ERRORS: '0',
    }
    result = config.getHighlightParsingError()
    expect(result).toEqual(false)

    process.env = {
      HIGHLIGHT_PARSING_ERRORS: 'false',
    }
    result = config.getHighlightParsingError()
    expect(result).toEqual(false)
  })
})
