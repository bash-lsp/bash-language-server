import { z } from 'zod'

import { DEFAULT_LOG_LEVEL, LOG_LEVEL_ENV_VAR, LOG_LEVELS } from './util/logger'

export const ConfigSchema = z.object({
  // Maximum number of files to analyze in the background. Set to 0 to disable background analysis.
  backgroundAnalysisMaxFiles: z.number().int().min(0).default(500),

  // Enable diagnostics for source errors. Ignored if includeAllWorkspaceSymbols is true.
  enableSourceErrorDiagnostics: z.boolean().default(false),

  // Glob pattern for finding and parsing shell script files in the workspace. Used by the background analysis features across files.
  globPattern: z.string().trim().default('**/*@(.sh|.inc|.bash|.command)'),

  // Configure explainshell server endpoint in order to get hover documentation on flags and options.
  // And empty string will disable the feature.
  explainshellEndpoint: z.string().trim().default(''),

  // Log level for the server. To set the right log level from the start please also use the environment variable 'BASH_IDE_LOG_LEVEL'.
  logLevel: z.enum(LOG_LEVELS).default(DEFAULT_LOG_LEVEL),

  // Controls how symbols (e.g. variables and functions) are included and used for completion, documentation, and renaming.
  // If false, then we only include symbols from sourced files (i.e. using non dynamic statements like 'source file.sh' or '. file.sh' or following ShellCheck directives).
  // If true, then all symbols from the workspace are included.
  includeAllWorkspaceSymbols: z.boolean().default(false),

  // Additional ShellCheck arguments. Note that we already add the following arguments: --shell, --format, --external-sources."
  shellcheckArguments: z
    .preprocess((arg) => {
      let argsList: string[] = []
      if (typeof arg === 'string') {
        argsList = arg.split(' ')
      } else if (Array.isArray(arg)) {
        argsList = arg as string[]
      }

      return argsList.map((s) => s.trim()).filter((s) => s.length > 0)
    }, z.array(z.string()))
    .default([]),

  // Controls the executable used for ShellCheck linting information. An empty string will disable linting.
  shellcheckPath: z.string().trim().default('shellcheck'),

  shfmt: z
    .object({
      // Controls the executable used for Shfmt formatting. An empty string will disable formatting
      path: z.string().trim().default('shfmt'),

      // Ignore shfmt config options in .editorconfig (always use language server config)
      ignoreEditorconfig: z.boolean().default(false),

      // Language dialect to use when parsing (bash/posix/mksh/bats).
      languageDialect: z.enum(['auto', 'bash', 'posix', 'mksh', 'bats']).default('auto'),

      // Allow boolean operators (like && and ||) to start a line.
      binaryNextLine: z.boolean().default(false),

      // Indent patterns in case statements.
      caseIndent: z.boolean().default(false),

      // Place function opening braces on a separate line.
      funcNextLine: z.boolean().default(false),

      // (Deprecated) Keep column alignment padding.
      keepPadding: z.boolean().default(false),

      // Simplify code before formatting.
      simplifyCode: z.boolean().default(false),

      // Follow redirection operators with a space.
      spaceRedirects: z.boolean().default(false),
    })
    .default({}),
})

export type Config = z.infer<typeof ConfigSchema>

export function getConfigFromEnvironmentVariables(): {
  config: Config
  environmentVariablesUsed: string[]
} {
  const rawConfig = {
    backgroundAnalysisMaxFiles: toNumber(process.env.BACKGROUND_ANALYSIS_MAX_FILES),
    enableSourceErrorDiagnostics: toBoolean(process.env.ENABLE_SOURCE_ERROR_DIAGNOSTICS),
    explainshellEndpoint: process.env.EXPLAINSHELL_ENDPOINT,
    globPattern: process.env.GLOB_PATTERN,
    includeAllWorkspaceSymbols: toBoolean(process.env.INCLUDE_ALL_WORKSPACE_SYMBOLS),
    logLevel: process.env[LOG_LEVEL_ENV_VAR],
    shellcheckArguments: process.env.SHELLCHECK_ARGUMENTS,
    shellcheckPath: process.env.SHELLCHECK_PATH,
    shfmt: {
      path: process.env.SHFMT_PATH,
      ignoreEditorconfig: toBoolean(process.env.SHFMT_IGNORE_EDITORCONFIG),
      languageDialect: process.env.SHFMT_LANGUAGE_DIALECT,
      binaryNextLine: toBoolean(process.env.SHFMT_BINARY_NEXT_LINE),
      caseIndent: toBoolean(process.env.SHFMT_CASE_INDENT),
      funcNextLine: toBoolean(process.env.SHFMT_FUNC_NEXT_LINE),
      keepPadding: toBoolean(process.env.SHFMT_KEEP_PADDING),
      simplifyCode: toBoolean(process.env.SHFMT_SIMPLIFY_CODE),
      spaceRedirects: toBoolean(process.env.SHFMT_SPACE_REDIRECTS),
    },
  }

  const environmentVariablesUsed = Object.entries(rawConfig)
    .filter(
      ([key, value]) =>
        !['undefined', 'object'].includes(typeof value) &&
        ![null, 'logLevel'].includes(key),
    )
    .map(([key]) => key)

  const config = ConfigSchema.parse(rawConfig)

  return { config, environmentVariablesUsed }
}

export function getDefaultConfiguration(): Config {
  return ConfigSchema.parse({})
}

const toBoolean = (s?: string): boolean | undefined =>
  typeof s !== 'undefined' ? s === 'true' || s === '1' : undefined

const toNumber = (s?: string): number | undefined =>
  typeof s !== 'undefined' ? parseInt(s, 10) : undefined
