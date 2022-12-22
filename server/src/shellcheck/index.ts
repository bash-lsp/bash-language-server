import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { spawn } from 'child_process'
import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { analyzeShebang } from '../util/shebang'
import { CODE_TO_TAGS, LEVEL_TO_SEVERITY } from './config'
import {
  ShellCheckComment,
  ShellCheckReplacement,
  ShellCheckResult,
  ShellCheckResultSchema,
} from './types'

const SUPPORTED_BASH_DIALECTS = ['sh', 'bash', 'dash', 'ksh']

type LinterOptions = {
  executablePath: string
  console: LSP.RemoteConsole
  cwd?: string
}

export class Linter {
  public executablePath: string
  private cwd: string
  private console: LSP.RemoteConsole
  private _canLint: boolean

  constructor({ console, cwd, executablePath }: LinterOptions) {
    this.executablePath = executablePath
    this.cwd = cwd || process.cwd()
    this._canLint = true
    this.console = console
  }

  public get canLint(): boolean {
    return this._canLint
  }

  public async lint(
    document: TextDocument,
    sourcePaths: string[],
    additionalShellCheckArguments: string[] = [],
  ): Promise<{ diagnostics: LSP.Diagnostic[]; codeActions: LSP.CodeAction[] }> {
    if (!this._canLint) {
      return { diagnostics: [], codeActions: [] }
    }

    const result = await this.runShellCheck(
      document,
      [...sourcePaths, dirname(fileURLToPath(document.uri))],
      additionalShellCheckArguments,
    )
    if (!this._canLint) {
      return { diagnostics: [], codeActions: [] }
    }

    return mapShellCheckResult({ document, result })
  }

  private async runShellCheck(
    document: TextDocument,
    sourcePaths: string[],
    additionalArgs: string[] = [],
  ): Promise<ShellCheckResult> {
    const documentText = document.getText()

    const { shellDialect } = analyzeShebang(documentText)
    // NOTE: that ShellCheck actually does shebang parsing, but we manually
    // do it here in order to fallback to bash. This enables parsing files
    // with a bash syntax.
    const shellName =
      shellDialect && SUPPORTED_BASH_DIALECTS.includes(shellDialect)
        ? shellDialect
        : 'bash'

    const sourcePathsArgs = sourcePaths
      .map((folder) => folder.trim())
      .filter((folderName) => folderName)
      .map((folderName) => `--source-path=${folderName}`)

    const args = [
      `--shell=${shellName}`,
      '--format=json1',
      '--external-sources',
      ...sourcePathsArgs,
      ...additionalArgs,
    ]

    this.console.log(`ShellCheck: running "${this.executablePath} ${args.join(' ')}"`)

    let out = ''
    let err = ''
    const proc = new Promise((resolve, reject) => {
      const proc = spawn(this.executablePath, [...args, '-'], { cwd: this.cwd })
      proc.on('error', reject)
      proc.on('close', resolve)
      proc.stdout.on('data', (data) => (out += data))
      proc.stderr.on('data', (data) => (err += data))
      proc.stdin.on('error', () => {
        // XXX: Ignore STDIN errors in case the process ends too quickly, before we try to
        // write. If we write after the process ends without this, we get an uncatchable EPIPE.
        // This is solved in Node >= 15.1 by the "on('spawn', ...)" event, but we need to
        // support earlier versions.
      })
      proc.stdin.end(documentText)
    })

    // XXX: do we care about exit code? 0 means "ok", 1 possibly means "errors",
    // but the presence of parseable errors in the output is also sufficient to
    // distinguish.
    let exit
    try {
      exit = await proc
    } catch (e) {
      // TODO: we could do this up front?
      if ((e as any).code === 'ENOENT') {
        // shellcheck path wasn't found, don't try to lint any more:
        this.console.warn(
          `ShellCheck: disabling linting as no executable was found at path '${this.executablePath}'`,
        )
        this._canLint = false
        return { comments: [] }
      }
      throw new Error(
        `ShellCheck: failed with code ${exit}: ${e}\nout:\n${out}\nerr:\n${err}`,
      )
    }

    let raw
    try {
      raw = JSON.parse(out)
    } catch (e) {
      throw new Error(
        `ShellCheck: json parse failed with error ${e}\nout:\n${out}\nerr:\n${err}`,
      )
    }

    return ShellCheckResultSchema.parse(raw)
  }
}
function mapShellCheckResult({
  document,
  result,
}: {
  document: TextDocument
  result: ShellCheckResult
}): {
  diagnostics: LSP.Diagnostic[]
  codeActions: LSP.CodeAction[]
} {
  const diagnostics: LSP.Diagnostic[] = []
  const codeActions: LSP.CodeAction[] = []

  for (const comment of result.comments) {
    const start: LSP.Position = {
      line: comment.line - 1,
      character: comment.column - 1,
    }
    const end: LSP.Position = {
      line: comment.endLine - 1,
      character: comment.endColumn - 1,
    }

    const diagnostic: LSP.Diagnostic = {
      message: comment.message,
      severity: LEVEL_TO_SEVERITY[comment.level] || LSP.DiagnosticSeverity.Error,
      code: `SC${comment.code}`,
      source: 'shellcheck',
      range: LSP.Range.create(start, end),
      codeDescription: {
        href: `https://www.shellcheck.net/wiki/SC${comment.code}`,
      },
      tags: CODE_TO_TAGS[comment.code],
      // NOTE: we could use the 'data' property this enable easier fingerprinting
    }

    diagnostics.push(diagnostic)

    const codeAction = CodeActionProvider.getCodeAction({
      comment,
      document,
      diagnostics: [diagnostic],
    })

    if (codeAction) {
      codeActions.push(codeAction)
    }
  }

  return { diagnostics, codeActions }
}

/**
 * Code has been adopted from https://github.com/vscode-shellcheck/vscode-shellcheck/
 * and modified to fit the needs of this project.
 *
 * The MIT License (MIT)
 * Copyright (c) Timon Wong
 */
class CodeActionProvider {
  public static getCodeAction({
    comment,
    document,
    diagnostics,
  }: {
    comment: ShellCheckComment
    document: TextDocument
    diagnostics: LSP.Diagnostic[]
  }): LSP.CodeAction | null {
    const { code, fix } = comment
    if (!fix || fix.replacements.length === 0) {
      return null
    }

    const { replacements } = fix
    if (replacements.length === 0) {
      return null
    }

    const edits = this.getTextEdits(replacements)
    if (!edits.length) {
      return null
    }

    return {
      title: `Apply fix for SC${code}`,
      diagnostics,
      edit: {
        changes: {
          [document.uri]: edits,
        },
      },
      kind: LSP.CodeActionKind.QuickFix,
    }
  }
  private static getTextEdits(
    replacements: ReadonlyArray<ShellCheckReplacement>,
  ): LSP.TextEdit[] {
    if (replacements.length === 1) {
      return [this.getTextEdit(replacements[0])]
    } else if (replacements.length === 2) {
      return [this.getTextEdit(replacements[1]), this.getTextEdit(replacements[0])]
    }

    return []
  }
  private static getTextEdit(replacement: ShellCheckReplacement): LSP.TextEdit {
    const startPos = LSP.Position.create(replacement.line - 1, replacement.column - 1)
    const endPos = LSP.Position.create(replacement.endLine - 1, replacement.endColumn - 1)
    return {
      range: LSP.Range.create(startPos, endPos),
      newText: replacement.replacement,
    }
  }
}
