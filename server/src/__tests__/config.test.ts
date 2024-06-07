import { ConfigSchema, getConfigFromEnvironmentVariables } from '../config'
import { LOG_LEVEL_ENV_VAR } from '../util/logger'

describe('ConfigSchema', () => {
  it('returns a default', () => {
    expect(ConfigSchema.parse({})).toMatchInlineSnapshot(`
      {
        "backgroundAnalysisMaxFiles": 500,
        "enableSourceErrorDiagnostics": false,
        "explainshellEndpoint": "",
        "globPattern": "**/*@(.sh|.inc|.bash|.command)",
        "includeAllWorkspaceSymbols": false,
        "logLevel": "info",
        "shellcheckArguments": [],
        "shellcheckPath": "shellcheck",
        "shfmt": {
          "binaryNextLine": false,
          "caseIndent": false,
          "funcNextLine": false,
          "ignoreEditorconfig": false,
          "keepPadding": false,
          "languageDialect": "auto",
          "path": "shfmt",
          "simplifyCode": false,
          "spaceRedirects": false,
        },
      }
    `)
  })
  it('parses an object', () => {
    expect(
      ConfigSchema.parse({
        backgroundAnalysisMaxFiles: 1,
        explainshellEndpoint: 'localhost:8080',
        globPattern: '**/*@(.sh)',
        includeAllWorkspaceSymbols: true,
        shellcheckArguments: ' -e SC2001  -e SC2002 ',
        shellcheckPath: '',
        shfmt: {
          binaryNextLine: true,
          caseIndent: true,
          funcNextLine: true,
          ignoreEditorconfig: true,
          keepPadding: true,
          languageDialect: 'posix',
          path: 'myshfmt',
          simplifyCode: true,
          spaceRedirects: true,
        },
      }),
    ).toMatchInlineSnapshot(`
      {
        "backgroundAnalysisMaxFiles": 1,
        "enableSourceErrorDiagnostics": false,
        "explainshellEndpoint": "localhost:8080",
        "globPattern": "**/*@(.sh)",
        "includeAllWorkspaceSymbols": true,
        "logLevel": "info",
        "shellcheckArguments": [
          "-e",
          "SC2001",
          "-e",
          "SC2002",
        ],
        "shellcheckPath": "",
        "shfmt": {
          "binaryNextLine": true,
          "caseIndent": true,
          "funcNextLine": true,
          "ignoreEditorconfig": true,
          "keepPadding": true,
          "languageDialect": "posix",
          "path": "myshfmt",
          "simplifyCode": true,
          "spaceRedirects": true,
        },
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
      {
        "backgroundAnalysisMaxFiles": 500,
        "enableSourceErrorDiagnostics": false,
        "explainshellEndpoint": "",
        "globPattern": "**/*@(.sh|.inc|.bash|.command)",
        "includeAllWorkspaceSymbols": false,
        "logLevel": "info",
        "shellcheckArguments": [],
        "shellcheckPath": "shellcheck",
        "shfmt": {
          "binaryNextLine": false,
          "caseIndent": false,
          "funcNextLine": false,
          "ignoreEditorconfig": false,
          "keepPadding": false,
          "languageDialect": "auto",
          "path": "shfmt",
          "simplifyCode": false,
          "spaceRedirects": false,
        },
      }
    `)
  })
  it('preserves an empty string', () => {
    process.env = {
      SHELLCHECK_PATH: '',
      SHFMT_PATH: '',
      EXPLAINSHELL_ENDPOINT: '',
    }
    const { config } = getConfigFromEnvironmentVariables()
    expect(config).toMatchInlineSnapshot(`
      {
        "backgroundAnalysisMaxFiles": 500,
        "enableSourceErrorDiagnostics": false,
        "explainshellEndpoint": "",
        "globPattern": "**/*@(.sh|.inc|.bash|.command)",
        "includeAllWorkspaceSymbols": false,
        "logLevel": "info",
        "shellcheckArguments": [],
        "shellcheckPath": "",
        "shfmt": {
          "binaryNextLine": false,
          "caseIndent": false,
          "funcNextLine": false,
          "ignoreEditorconfig": false,
          "keepPadding": false,
          "languageDialect": "auto",
          "path": "",
          "simplifyCode": false,
          "spaceRedirects": false,
        },
      }
    `)
  })

  it('parses environment variables', () => {
    process.env = {
      SHELLCHECK_PATH: '/path/to/shellcheck',
      SHELLCHECK_ARGUMENTS: '-e SC2001',
      SHFMT_PATH: '/path/to/shfmt',
      SHFMT_CASE_INDENT: 'true',
      EXPLAINSHELL_ENDPOINT: 'localhost:8080',
      GLOB_PATTERN: '*.*',
      BACKGROUND_ANALYSIS_MAX_FILES: '1',
      [LOG_LEVEL_ENV_VAR]: 'error',
    }
    const { config } = getConfigFromEnvironmentVariables()
    expect(config).toMatchInlineSnapshot(`
      {
        "backgroundAnalysisMaxFiles": 1,
        "enableSourceErrorDiagnostics": false,
        "explainshellEndpoint": "localhost:8080",
        "globPattern": "*.*",
        "includeAllWorkspaceSymbols": false,
        "logLevel": "error",
        "shellcheckArguments": [
          "-e",
          "SC2001",
        ],
        "shellcheckPath": "/path/to/shellcheck",
        "shfmt": {
          "binaryNextLine": false,
          "caseIndent": true,
          "funcNextLine": false,
          "ignoreEditorconfig": false,
          "keepPadding": false,
          "languageDialect": "auto",
          "path": "/path/to/shfmt",
          "simplifyCode": false,
          "spaceRedirects": false,
        },
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
      INCLUDE_ALL_WORKSPACE_SYMBOLS: 'true',
    }
    let result = getConfigFromEnvironmentVariables().config.includeAllWorkspaceSymbols
    expect(result).toEqual(true)

    process.env = {
      INCLUDE_ALL_WORKSPACE_SYMBOLS: '1',
    }
    result = getConfigFromEnvironmentVariables().config.includeAllWorkspaceSymbols
    expect(result).toEqual(true)

    process.env = {
      INCLUDE_ALL_WORKSPACE_SYMBOLS: '0',
    }
    result = getConfigFromEnvironmentVariables().config.includeAllWorkspaceSymbols
    expect(result).toEqual(false)

    process.env = {
      INCLUDE_ALL_WORKSPACE_SYMBOLS: 'false',
    }
    result = getConfigFromEnvironmentVariables().config.includeAllWorkspaceSymbols
    expect(result).toEqual(false)
  })
})
