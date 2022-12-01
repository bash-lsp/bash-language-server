import { spawn } from 'child_process'
import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { getShellCheckArguments } from '../config'
import { analyzeShebang } from '../util/shebang'
import { CODE_TO_TAGS, LEVEL_TO_SEVERITY } from './config'
import { ShellCheckResult } from './types'

const SUPPORTED_BASH_DIALECTS = ['sh', 'bash', 'dash', 'ksh']

type LinterOptions = {
  executablePath: string | null
  console: LSP.RemoteConsole
  cwd?: string
}

export class Linter {
  public executablePath: string | null
  private cwd: string
  private console: LSP.RemoteConsole
  private _canLint: boolean

  constructor({ console, cwd, executablePath }: LinterOptions) {
    this.executablePath = executablePath
    this.cwd = cwd || process.cwd()
    this._canLint = !!this.executablePath // TODO: any reason to create a linter if the path is null?
    this.console = console
  }

  public get canLint(): boolean {
    return this._canLint
  }

  public async lint(
    document: TextDocument,
    folders: LSP.WorkspaceFolder[],
  ): Promise<LSP.Diagnostic[]> {
    if (!this.executablePath || !this._canLint) return []

    const additionalArgs = getShellCheckArguments()

    const result = await this.runShellCheck(
      this.executablePath,
      document,
      folders,
      additionalArgs,
    )
    if (!this._canLint) return []

    const diags: LSP.Diagnostic[] = []
    for (const comment of result.comments) {
      const start: LSP.Position = {
        line: comment.line - 1,
        character: comment.column - 1,
      }
      const end: LSP.Position = {
        line: comment.endLine - 1,
        character: comment.endColumn - 1,
      }

      diags.push({
        message: comment.message,
        severity: LEVEL_TO_SEVERITY[comment.level] || LSP.DiagnosticSeverity.Error,
        code: `SC${comment.code}`,
        source: 'shellcheck',
        range: LSP.Range.create(start, end),
        codeDescription: {
          href: `https://www.shellcheck.net/wiki/SC${comment.code}`,
        },
        tags: CODE_TO_TAGS[comment.code],
      })
    }

    return diags
  }

  private async runShellCheck(
    executablePath: string,
    document: TextDocument,
    folders: LSP.WorkspaceFolder[],
    additionalArgs: string[] = [],
  ): Promise<ShellCheckResult> {
    const documentText = document.getText()

    const { shellDialect } = analyzeShebang(documentText)
    const shellName =
      shellDialect && SUPPORTED_BASH_DIALECTS.includes(shellDialect)
        ? shellDialect
        : 'bash'

    const workspaceFolderSourcePaths = folders
      // NOTE: on some system folder.name is undefined
      .map((folder) => folder?.name.trim())
      .filter((folderName) => folderName)
      .map((folderName) => `--source-path=${folderName}`)

    const args = [
      `--shell=${shellName}`,
      '--format=json1',
      '--external-sources',
      `--source-path=${this.cwd}`,
      ...workspaceFolderSourcePaths,
      ...additionalArgs,
    ]

    this.console.log(`ShellCheck: running "${executablePath} ${args.join(' ')}"`)

    let out = ''
    let err = ''
    const proc = new Promise((resolve, reject) => {
      const proc = spawn(executablePath, [...args, '-'], { cwd: this.cwd })
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
    assertShellCheckResult(raw)
    return raw
  }
}
export function assertShellCheckResult(val: any): asserts val is ShellCheckResult {
  if (val !== null && typeof val !== 'object') {
    throw new Error(`shellcheck: unexpected json output ${typeof val}`)
  }

  if (!Array.isArray(val.comments)) {
    throw new Error(
      `shellcheck: unexpected json output: expected 'comments' array ${typeof val.comments}`,
    )
  }

  for (const idx in val.comments) {
    const comment = val.comments[idx]
    if (comment !== null && typeof comment != 'object') {
      throw new Error(
        `shellcheck: expected comment at index ${idx} to be object, found ${typeof comment}`,
      )
    }
    if (typeof comment.file !== 'string')
      throw new Error(
        `shellcheck: expected comment file at index ${idx} to be string, found ${typeof comment.file}`,
      )
    if (typeof comment.level !== 'string')
      throw new Error(
        `shellcheck: expected comment level at index ${idx} to be string, found ${typeof comment.level}`,
      )
    if (typeof comment.message !== 'string')
      throw new Error(
        `shellcheck: expected comment message at index ${idx} to be string, found ${typeof comment.level}`,
      )
    if (typeof comment.line !== 'number')
      throw new Error(
        `shellcheck: expected comment line at index ${idx} to be number, found ${typeof comment.line}`,
      )
    if (typeof comment.endLine !== 'number')
      throw new Error(
        `shellcheck: expected comment endLine at index ${idx} to be number, found ${typeof comment.endLine}`,
      )
    if (typeof comment.column !== 'number')
      throw new Error(
        `shellcheck: expected comment column at index ${idx} to be number, found ${typeof comment.column}`,
      )
    if (typeof comment.endColumn !== 'number')
      throw new Error(
        `shellcheck: expected comment endColumn at index ${idx} to be number, found ${typeof comment.endColumn}`,
      )
    if (typeof comment.code !== 'number')
      throw new Error(
        `shellcheck: expected comment code at index ${idx} to be number, found ${typeof comment.code}`,
      )
  }
}
