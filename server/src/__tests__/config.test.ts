import { ConfigSchema, getConfigFromEnvironmentVariables } from '../config'
import { LOG_LEVEL_ENV_VAR } from '../util/logger'

describe('ConfigSchema', () => {
  it('returns a default', () => {
    expect(ConfigSchema.parse({})).toMatchInlineSnapshot(`
      Object {
        "backgroundAnalysisMaxFiles": 500,
        "explainshellEndpoint": "",
        "globPattern": "**/*@(.sh|.inc|.bash|.command)",
        "highlightParsingErrors": false,
        "includeAllWorkspaceSymbols": false,
        "logLevel": "info",
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
        "logLevel": "info",
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

  it('allows shellcheckArguments to be an array', () => {
    expect(
      ConfigSchema.parse({
        shellcheckArguments: [' -e ', 'SC2001', '-e', 'SC2002 '],
      }).shellcheckArguments,
    ).toEqual(['-e', 'SC2001', '-e', 'SC2002'])
  })
})
describe('getConfigFromEnvironmentVariables', () => {
  it('returns a default', () => {
    process.env = {}
    const { config } = getConfigFromEnvironmentVariables()
    expect(config).toMatchInlineSnapshot(`
      Object {
        "backgroundAnalysisMaxFiles": 500,
        "explainshellEndpoint": "",
        "globPattern": "**/*@(.sh|.inc|.bash|.command)",
        "highlightParsingErrors": false,
        "includeAllWorkspaceSymbols": false,
        "logLevel": "info",
        "shellcheckArguments": Array [],
        "shellcheckPath": "shellcheck",
      }
    `)
  })
  it('preserves an empty string', () => {
    process.env = {
      SHELLCHECK_PATH: '',
      EXPLAINSHELL_ENDPOINT: '',
    }
    const { config } = getConfigFromEnvironmentVariables()
    expect(config).toMatchInlineSnapshot(`
      Object {
        "backgroundAnalysisMaxFiles": 500,
        "explainshellEndpoint": "",
        "globPattern": "**/*@(.sh|.inc|.bash|.command)",
        "highlightParsingErrors": false,
        "includeAllWorkspaceSymbols": false,
        "logLevel": "info",
        "shellcheckArguments": Array [],
        "shellcheckPath": "",
      }
    `)
  })

  it('parses environment variables', () => {
    process.env = {
      SHELLCHECK_PATH: '/path/to/shellcheck',
      SHELLCHECK_ARGUMENTS: '-e SC2001',
      EXPLAINSHELL_ENDPOINT: 'localhost:8080',
      GLOB_PATTERN: '*.*',
      BACKGROUND_ANALYSIS_MAX_FILES: '1',
      [LOG_LEVEL_ENV_VAR]: 'error',
    }
    const { config } = getConfigFromEnvironmentVariables()
    expect(config).toMatchInlineSnapshot(`
      Object {
        "backgroundAnalysisMaxFiles": 1,
        "explainshellEndpoint": "localhost:8080",
        "globPattern": "*.*",
        "highlightParsingErrors": false,
        "includeAllWorkspaceSymbols": false,
        "logLevel": "error",
        "shellcheckArguments": Array [
          "-e",
          "SC2001",
        ],
        "shellcheckPath": "/path/to/shellcheck",
      }
    `)
  })

  it('parses environment variable with excessive white space', () => {
    process.env = {
      SHELLCHECK_ARGUMENTS: ' -e SC2001  -e SC2002 ',
    }
    const result = getConfigFromEnvironmentVariables().config.shellcheckArguments
    expect(result).toEqual(['-e', 'SC2001', '-e', 'SC2002'])
  })
  it('parses boolean environment variables', () => {
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
