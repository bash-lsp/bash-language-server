export const DEFAULT_GLOB_PATTERN = '**/*@(.sh|.inc|.bash|.command)'
export const DEFAULT_BACKGROUND_ANALYSIS_MAX_FILES = 500

export function getShellcheckPath(): string | null {
  const { SHELLCHECK_PATH } = process.env
  // If this is an empty string, this should coalesce to null and disable linting via shellcheck:
  return typeof SHELLCHECK_PATH === 'string' ? SHELLCHECK_PATH || null : 'shellcheck'
}

export function getExplainshellEndpoint(): string | null {
  const { EXPLAINSHELL_ENDPOINT } = process.env
  return typeof EXPLAINSHELL_ENDPOINT === 'string' && EXPLAINSHELL_ENDPOINT.trim() !== ''
    ? EXPLAINSHELL_ENDPOINT
    : null
}

/**
 * Get the glob pattern for files to run background analysis on.
 */
export function getGlobPattern(): string {
  const { GLOB_PATTERN } = process.env
  return typeof GLOB_PATTERN === 'string' && GLOB_PATTERN.trim() !== ''
    ? GLOB_PATTERN
    : DEFAULT_GLOB_PATTERN
}

export function getHighlightParsingError(): boolean {
  const { HIGHLIGHT_PARSING_ERRORS } = process.env
  return typeof HIGHLIGHT_PARSING_ERRORS !== 'undefined'
    ? toBoolean(HIGHLIGHT_PARSING_ERRORS)
    : false
}

/**
 * Get the maximum number of files to run background analysis on.
 */
export function getBackgroundAnalysisMaxFiles(): number {
  const { BACKGROUND_ANALYSIS_MAX_FILES } = process.env
  const parsed = parseInt(BACKGROUND_ANALYSIS_MAX_FILES || '', 10)
  return !isNaN(parsed) ? parsed : DEFAULT_BACKGROUND_ANALYSIS_MAX_FILES
}

const toBoolean = (s: string): boolean => s === 'true' || s === '1'
