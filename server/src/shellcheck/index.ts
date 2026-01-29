import { dirname } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { spawn } from 'child_process'
import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { debounce } from '../util/async'
import { logger } from '../util/logger'
import { analyzeFile } from '../util/shebang'
import { CODE_TO_TAGS, LEVEL_TO_SEVERITY, SHELLCHECK_DIALECTS } from './config'
import {
  ShellCheckComment,
  ShellCheckReplacement,
  ShellCheckResult,
  ShellCheckResultSchema,
} from './types'

const DEBOUNCE_MS = 500

function safeFileURLToPath(uri: string): string | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'file:') {
      return null
    }
    return fileURLToPath(uri)
  } catch {
    return null
  }
}

type LinterOptions = {
  executablePath: string
  cwd?: string
}

export type LintingResult = {
  diagnostics: LSP.Diagnostic[]
  codeActions: Record<string, LSP.CodeAction | undefined>
}

export class Linter {
  private cwd: string
  public executablePath: string
  private uriToDebouncedExecuteLint: {
    [uri: string]: InstanceType<typeof Linter>['executeLint']
  }
  private _canLint: boolean

  constructor({ cwd, executablePath }: LinterOptions) {
    this._canLint = true
    this.cwd = cwd || process.cwd()
    this.executablePath = executablePath
    this.uriToDebouncedExecuteLint = Object.create(null)
  }

  public get canLint(): boolean {
    return this._canLint
  }

  public async lint(
    document: TextDocument,
    sourcePaths: string[],
    additionalShellCheckArguments: string[] = [],
  ): Promise<LintingResult> {
    if (!this._canLint) {
      return { diagnostics: [], codeActions: {} }
    }

    const { uri } = document
    let debouncedExecuteLint = this.uriToDebouncedExecuteLint[uri]
    if (!debouncedExecuteLint) {
      debouncedExecuteLint = debounce(this.executeLint.bind(this), DEBOUNCE_MS)
      this.uriToDebouncedExecuteLint[uri] = debouncedExecuteLint
    }

    return debouncedExecuteLint(document, sourcePaths, additionalShellCheckArguments)
  }

  private async executeLint(
    document: TextDocument,
    sourcePaths: string[],
    additionalShellCheckArguments: string[] = [],
  ): Promise<LintingResult> {
    const documentText = document.getText()

    const dialect = analyzeFile(document.uri, documentText)
    let shellName: string | null
    // NOTE: ShellCheck performs shebang parsing and shell detection itself.
    // Do not interfere with that in any way because it is smarter than us.
    //
    // We perform tentative shell detection manually in order to fall back to
    // bash for files without a shebang or a shell type directive, so only pass
    // an override if the file _does not_ have a shebang or a shell type directive.
    if (dialect.shebang || dialect.directive) {
      shellName = null
    } else if (dialect.dialect && SHELLCHECK_DIALECTS.includes(dialect.dialect)) {
      shellName = dialect.dialect
    } else {
      // Bail if the dialect isn't supported by ShellCheck, but only if it's our
      // override. Never bail if the file has an (unsupported) shebang or a shell
      // type directive, because ShellCheck is better than us at reporting this.
      return { diagnostics: [], codeActions: {} }
    }

    const documentPath = safeFileURLToPath(document.uri)
    const effectiveSourcePaths = documentPath
      ? [...sourcePaths, dirname(documentPath)]
      : sourcePaths

    const result = await this.runShellCheck(
      documentText,
      shellName,
      effectiveSourcePaths,
      additionalShellCheckArguments,
    )

    if (!this._canLint) {
      return { diagnostics: [], codeActions: {} }
    }

    // Clean up the debounced function
    delete this.uriToDebouncedExecuteLint[document.uri]

    return mapShellCheckResult({ uri: document.uri, result })
  }

  private async runShellCheck(
    documentText: string,
    shellName: string | null,
    sourcePaths: string[],
    additionalArgs: string[] = [],
  ): Promise<ShellCheckResult> {
    const sourcePathsArgs = sourcePaths
      .map((folder) => folder.trim())
      .filter((folderName) => folderName)
      .map((folderName) => `--source-path=${folderName}`)

    const args = [
      '--format=json1',
      '--external-sources',
      ...sourcePathsArgs,
      ...additionalArgs,
    ]

    // only pass a `--shell` argument if we have an override AND none is provided
    // by the user in their config. See #1064.
    const userArgs = additionalArgs.join(' ')
    if (shellName && !(userArgs.includes('--shell') || userArgs.includes('-s '))) {
      args.unshift(`--shell=${shellName}`)
    }

    logger.debug(`ShellCheck: running "${this.executablePath} ${args.join(' ')}"`)

    let out = ''
    let err = ''
    const proc = new Promise((resolve, reject) => {
      const proc = spawn(this.executablePath, [...args, '-'], { cwd: this.cwd })
      proc.on('error', reject)
      proc.on('close', resolve)
      proc.stdout.on('data', (data) => (out += data))
      proc.stderr.on('data', (data) => (err += data))
      proc.stdin.on('error', () => {
        // NOTE: Ignore STDIN errors in case the process ends too quickly, before we try to
        // write. If we write after the process ends without this, we get an uncatchable EPIPE.
        // This is solved in Node >= 15.1 by the "on('spawn', ...)" event, but we need to
        // support earlier versions.
      })
      proc.stdin.end(documentText)
    })

    // NOTE: do we care about exit code? 0 means "ok", 1 possibly means "errors",
    // but the presence of parseable errors in the output is also sufficient to
    // distinguish.
    let exit
    try {
      exit = await proc
    } catch (e) {
      // TODO: we could do this up front?
      if ((e as any).code === 'ENOENT') {
        // shellcheck path wasn't found, don't try to lint any more:
        logger.warn(
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

function mapShellCheckResult({ uri, result }: { uri: string; result: ShellCheckResult }) {
  const diagnostics: LintingResult['diagnostics'] = []
  const codeActions: LintingResult['codeActions'] = {}

  for (const comment of result.comments) {
    const range = LSP.Range.create(
      {
        line: comment.line - 1,
        character: comment.column - 1,
      },
      {
        line: comment.endLine - 1,
        character: comment.endColumn - 1,
      },
    )

    const id = `shellcheck|${comment.code}|${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`

    const diagnostic: LSP.Diagnostic = {
      message: comment.message,
      severity: LEVEL_TO_SEVERITY[comment.level] || LSP.DiagnosticSeverity.Error,
      code: `SC${comment.code}`,
      source: 'shellcheck',
      range,
      codeDescription: {
        href: `https://www.shellcheck.net/wiki/SC${comment.code}`,
      },
      tags: CODE_TO_TAGS[comment.code],
      data: {
        id,
      },
    }

    diagnostics.push(diagnostic)

    const codeAction = CodeActionProvider.getCodeAction({
      comment,
      diagnostics: [diagnostic],
      uri,
    })

    if (codeAction) {
      codeActions[id] = codeAction
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
    diagnostics,
    uri,
  }: {
    comment: ShellCheckComment
    diagnostics: LSP.Diagnostic[]
    uri: string
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
          [uri]: edits,
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
