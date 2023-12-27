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
  }

  const environmentVariablesUsed = Object.entries(rawConfig)
    .map(([key, value]) => (typeof value !== 'undefined' ? key : null))
    .filter((key): key is string => key !== null)
    .filter((key) => key !== 'logLevel') // logLevel is a special case that we ignore

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
