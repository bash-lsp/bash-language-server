import * as LSP from 'vscode-languageserver/node'

import { ShellCheckCommentLevel } from './types'

export const SUPPORTED_BASH_DIALECTS = ['sh', 'bash', 'dash', 'ksh']

// https://github.com/koalaman/shellcheck/wiki
export const CODE_TO_TAGS: Record<number, LSP.DiagnosticTag[] | undefined> = {
  2006: [LSP.DiagnosticTag.Deprecated],
  2007: [LSP.DiagnosticTag.Deprecated],
  2034: [LSP.DiagnosticTag.Unnecessary],
  2186: [LSP.DiagnosticTag.Deprecated],
  2196: [LSP.DiagnosticTag.Deprecated],
  2197: [LSP.DiagnosticTag.Deprecated],
}

// https://github.com/koalaman/shellcheck/blob/364c33395e2f2d5500307f01989f70241c247d5a/src/ShellCheck/Formatter/Format.hs#L50

export const LEVEL_TO_SEVERITY: Record<
  ShellCheckCommentLevel,
  LSP.DiagnosticSeverity | undefined
> = {
  error: LSP.DiagnosticSeverity.Error,
  warning: LSP.DiagnosticSeverity.Warning,
  info: LSP.DiagnosticSeverity.Information,
  style: LSP.DiagnosticSeverity.Hint,
}
