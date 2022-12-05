import { z } from 'zod'

export const ConfigSchema = z
  .object({
    // Glob pattern for finding and parsing shell script files in the workspace. Used by the background analysis features across files.
    globPattern: z.string().trim().default('**/*@(.sh|.inc|.bash|.command)'),

    // Controls if Treesitter parsing errors will be highlighted as problems.
    highlightParsingErrors: z.boolean().default(false),

    // Configure explainshell server endpoint in order to get hover documentation on flags and options.
    // And empty string will disable the feature.
    explainshellEndpoint: z.string().trim().default(''),

    // Controls the executable used for ShellCheck linting information. An empty string will disable linting.
    shellcheckPath: z.string().trim().default('shellcheck'),

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

    // Maximum number of files to analyze in the background. Set to 0 to disable background analysis.
    backgroundAnalysisMaxFiles: z.number().int().min(0).default(500),
  })
  .strict()

export type Config = z.infer<typeof ConfigSchema>

export function getConfigFromEnvironmentVariables(): {
  config: z.infer<typeof ConfigSchema>
  environmentVariablesUsed: string[]
} {
  const { HIGHLIGHT_PARSING_ERRORS } = process.env

  const rawConfig = {
    globPattern: process.env.GLOB_PATTERN,
    highlightParsingErrors:
      typeof HIGHLIGHT_PARSING_ERRORS !== 'undefined'
        ? toBoolean(HIGHLIGHT_PARSING_ERRORS)
        : undefined,
    explainshellEndpoint: process.env.EXPLAINSHELL_ENDPOINT,
    shellcheckPath: process.env.SHELLCHECK_PATH,
    shellcheckArguments: process.env.SHELLCHECK_ARGUMENTS,
    backgroundAnalysisMaxFiles: process.env.BACKGROUND_ANALYSIS_MAX_FILES,
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

const toBoolean = (s: string): boolean => s === 'true' || s === '1'
