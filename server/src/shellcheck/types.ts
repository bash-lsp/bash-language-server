export type ShellCheckResult = Readonly<{
  comments: ReadonlyArray<ShellCheckComment>
}>

// Constituent structures defined here:
// https://github.com/koalaman/shellcheck/blob/master/src/ShellCheck/Interface.hs
export type ShellCheckComment = Readonly<{
  file: string
  line: number // 1-based
  endLine: number // 1-based
  column: number // 1-based
  endColumn: number // 1-based
  level: string // See LEVEL_TO_SEVERITY
  code: number
  message: string
  fix?: {
    replacements: ReadonlyArray<ShellCheckReplacement>
  }
}>

export type ShellCheckReplacement = {
  precedence: number
  line: number
  endLine: number
  column: number
  endColumn: number
  insertionPoint: string
  replacement: string
}
