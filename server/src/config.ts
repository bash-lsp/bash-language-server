export function getExplainshellEndpoint(): string | null {
  const { EXPLAINSHELL_ENDPOINT } = process.env
  return typeof EXPLAINSHELL_ENDPOINT !== 'undefined' ? EXPLAINSHELL_ENDPOINT : null
}

export function getHighlightParsingError(): boolean {
  const { HIGHLIGHT_PARSING_ERRORS } = process.env
  return typeof HIGHLIGHT_PARSING_ERRORS !== 'undefined'
    ? HIGHLIGHT_PARSING_ERRORS === 'true'
    : true
}
