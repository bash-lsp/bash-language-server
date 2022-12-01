export type ShellCheckResult = Readonly<{
  comments: ReadonlyArray<ShellCheckComment>
}>

// Constituent structures defined here:
// https://github.com/koalaman/shellcheck/blob/4e703e5c61c6366bfd486d728bc624025e344e68/src/ShellCheck/Interface.hs#L221
export type ShellCheckComment = Readonly<{
  file: string
  line: number // 1-based
  endLine: number // 1-based
  column: number // 1-based
  endColumn: number // 1-based
  level: string // See mapShellcheckServerity
  code: number
  message: string

  // The Fix data type appears to be defined here. We aren't making use of
  // it yet but this might help down the road:
  // https://github.com/koalaman/shellcheck/blob/4e703e5c61c6366bfd486d728bc624025e344e68/src/ShellCheck/Interface.hs#L271
  // fix: any;
}>
