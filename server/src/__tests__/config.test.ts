import { ConfigSchema, getConfigFromEnvironmentVariables } from '../config'

describe('ConfigSchema', () => {
  it('returns a default', () => {
    expect(ConfigSchema.parse({})).toMatchInlineSnapshot(`
      Object {
        "backgroundAnalysisMaxFiles": 500,
        "explainshellEndpoint": "",
        "globPattern": "**/*@(.sh|.inc|.bash|.command)",
        "highlightParsingErrors": false,
        "includeAllWorkspaceSymbols": false,
        "shellcheckArguments": Array [],
        "shellcheckPath": "shellcheck",
      }
    `)
  })
  it('parses an object', () => {
    expect(
      ConfigSchema.parse({
        backgroundAnalysisMaxFiles: 1,
        explainshellEndpoint: 'localhost:8080',
        globPattern: '**/*@(.sh)',
        highlightParsingErrors: true,
        includeAllWorkspaceSymbols: true,
        shellcheckArguments: ' -e SC2001  -e SC2002 ',
        shellcheckPath: '',
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "backgroundAnalysisMaxFiles": 1,
        "explainshellEndpoint": "localhost:8080",
        "globPattern": "**/*@(.sh)",
        "highlightParsingErrors": true,
        "includeAllWorkspaceSymbols": true,
        "shellcheckArguments": Array [
          "-e",
          "SC2001",
          "-e",
          "SC2002",
        ],
        "shellcheckPath": "",
      }
    `)
  })
})
describe('getShellcheckPath', () => {
  it('defaults to "shellcheck"', () => {
    process.env = {}
    const result = getConfigFromEnvironmentVariables().config.shellcheckPath
    expect(result).toEqual('shellcheck')
  })

  it('preserves an empty string', () => {
    process.env = {
      SHELLCHECK_PATH: '',
    }
    const result = getConfigFromEnvironmentVariables().config.shellcheckPath
    expect(result).toEqual('')
  })

  it('parses environment variable', () => {
    process.env = {
      SHELLCHECK_PATH: '/path/to/shellcheck',
    }
    const result = getConfigFromEnvironmentVariables().config.shellcheckPath
    expect(result).toEqual('/path/to/shellcheck')
  })
})

describe('getShellCheckArguments', () => {
  it('defaults to an empty array', () => {
    process.env = {}
    const result = getConfigFromEnvironmentVariables().config.shellcheckArguments
    expect(result).toEqual([])
  })

  it('parses environment variable', () => {
    process.env = {
      SHELLCHECK_ARGUMENTS: '-e SC2001',
    }
    const result = getConfigFromEnvironmentVariables().config.shellcheckArguments
    expect(result).toEqual(['-e', 'SC2001'])
  })

  it('parses environment variable with excessive white space', () => {
    process.env = {
      SHELLCHECK_ARGUMENTS: ' -e SC2001  -e SC2002 ',
    }
    const result = getConfigFromEnvironmentVariables().config.shellcheckArguments
    expect(result).toEqual(['-e', 'SC2001', '-e', 'SC2002'])
  })
})

describe('getExplainshellEndpoint', () => {
  it('default to an empty string', () => {
    process.env = {}
    const result = getConfigFromEnvironmentVariables().config.explainshellEndpoint
    expect(result).toEqual('')
  })

  it('preserves the empty string', () => {
    process.env = {
      EXPLAINSHELL_ENDPOINT: '',
    }
    const result = getConfigFromEnvironmentVariables().config.explainshellEndpoint
    expect(result).toEqual('')
  })

  it('parses environment variable', () => {
    process.env = {
      EXPLAINSHELL_ENDPOINT: 'localhost:8080',
    }
    const result = getConfigFromEnvironmentVariables().config.explainshellEndpoint
    expect(result).toEqual('localhost:8080')
  })
})

describe('getGlobPattern', () => {
  it('parses environment variable', () => {
    process.env = {
      GLOB_PATTERN: '*.*',
    }
    const result = getConfigFromEnvironmentVariables().config.globPattern
    expect(result).toEqual('*.*')
  })
})

describe('highlightParsingError', () => {
  it('default to false', () => {
    process.env = {}
    const result = getConfigFromEnvironmentVariables().config.highlightParsingErrors
    expect(result).toEqual(false)
  })

  it('parses environment variable', () => {
    process.env = {
      HIGHLIGHT_PARSING_ERRORS: 'true',
    }
    let result = getConfigFromEnvironmentVariables().config.highlightParsingErrors
    expect(result).toEqual(true)

    process.env = {
      HIGHLIGHT_PARSING_ERRORS: '1',
    }
    result = getConfigFromEnvironmentVariables().config.highlightParsingErrors
    expect(result).toEqual(true)

    process.env = {
      HIGHLIGHT_PARSING_ERRORS: '0',
    }
    result = getConfigFromEnvironmentVariables().config.highlightParsingErrors
    expect(result).toEqual(false)

    process.env = {
      HIGHLIGHT_PARSING_ERRORS: 'false',
    }
    result = getConfigFromEnvironmentVariables().config.highlightParsingErrors
    expect(result).toEqual(false)
  })
})
