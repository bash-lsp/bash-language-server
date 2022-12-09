import { z } from 'zod'

export const ConfigSchema = z
  .object({
    // Maximum number of files to analyze in the background. Set to 0 to disable background analysis.
    backgroundAnalysisMaxFiles: z.number().int().min(0).default(500),

    // Glob pattern for finding and parsing shell script files in the workspace. Used by the background analysis features across files.
    globPattern: z.string().trim().default('**/*@(.sh|.inc|.bash|.command)'),

    // Configure explainshell server endpoint in order to get hover documentation on flags and options.
    // And empty string will disable the feature.
    explainshellEndpoint: z.string().trim().default(''),

    // Controls if Treesitter parsing errors will be highlighted as problems.
    highlightParsingErrors: z.boolean().default(false),

    // Controls how symbols (e.g. variables and functions) are included and used for completion and documentation.
    // If false, then we only include symbols from sourced files (i.e. using non dynamic statements like 'source file.sh' or '. file.sh').
    // If true, then all symbols from the workspace are included.
    includeAllWorkspaceSymbols: z.boolean().default(false),

    // Additional ShellCheck arguments. Note that we already add the following arguments: --shell, --format, --external-sources."
    shellcheckArguments: z
      .preprocess((arg) => {
        let argsList: string[] = []
        if (typeof arg === 'string') {
          argsList = arg.split(' ')
          //.map((s) => s.trim())
          //.filter((s) => s.length > 0)
        } else if (Array.isArray(arg)) {
          argsList = arg as string[]
        }

        return argsList.map((s) => s.trim()).filter((s) => s.length > 0)
      }, z.array(z.string()))
      .default([]),

    // Controls the executable used for ShellCheck linting information. An empty string will disable linting.
    shellcheckPath: z.string().trim().default('shellcheck'),
  })
  .strict()

export type Config = z.infer<typeof ConfigSchema>

export function getConfigFromEnvironmentVariables(): {
  config: z.infer<typeof ConfigSchema>
  environmentVariablesUsed: string[]
} {
  const rawConfig = {
    backgroundAnalysisMaxFiles: process.env.BACKGROUND_ANALYSIS_MAX_FILES,
    explainshellEndpoint: process.env.EXPLAINSHELL_ENDPOINT,
    globPattern: process.env.GLOB_PATTERN,
    highlightParsingErrors: toBoolean(process.env.HIGHLIGHT_PARSING_ERRORS),
    includeAllWorkspaceSymbols: toBoolean(process.env.INCLUDE_ALL_WORKSPACE_SYMBOLS),
    shellcheckArguments: process.env.SHELLCHECK_ARGUMENTS,
    shellcheckPath: process.env.SHELLCHECK_PATH,
  }

  const environmentVariablesUsed = Object.entries(rawConfig)
    .map(([key, value]) => (typeof value !== 'undefined' ? key : null))
    .filter((key) => key !== null) as string[]

  const config = ConfigSchema.parse(rawConfig)

  return { config, environmentVariablesUsed }
}

export function getDefaultConfiguration(): z.infer<typeof ConfigSchema> {
  return ConfigSchema.parse({})
}

const toBoolean = (s?: string): boolean | undefined =>
  typeof s !== 'undefined' ? s === 'true' || s === '1' : undefined
