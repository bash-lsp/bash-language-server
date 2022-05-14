import { spawn } from 'child_process'
import * as LSP from 'vscode-languageserver'

function formatMessage(comment: ShellcheckComment): string {
  return (comment.code ? `SC${comment.code}: ` : '') + comment.message
}

type LinterOptions = {
  executablePath: string | null
  cwd?: string
}

export default class Linter {
  private executablePath: string | null
  private cwd: string
  _canLint: boolean

  constructor(opts: LinterOptions) {
    this.executablePath = opts.executablePath
    this.cwd = opts.cwd || process.cwd()
    this._canLint = !!this.executablePath
  }

  public get canLint(): boolean {
    return this._canLint
  }

  public async lint(
    document: LSP.TextDocument,
    folders: LSP.WorkspaceFolder[],
  ): Promise<LSP.Diagnostic[]> {
    if (!this.executablePath || !this._canLint) return []

    const result = await this.runShellcheck(this.executablePath, document, folders)
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
        message: formatMessage(comment),
        severity: mapSeverity(comment.level),
        code: comment.code,
        source: 'shellcheck',
        range: { start, end },
      })
    }

    return diags
  }

  private async runShellcheck(
    executablePath: string,
    document: LSP.TextDocument,
    folders: LSP.WorkspaceFolder[],
  ): Promise<ShellcheckResult> {
    const args = ['--format=json1', '--external-sources', `--source-path=${this.cwd}`]
    for (const folder of folders) {
      args.push(`--source-path=${folder.name}`)
    }

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
      proc.stdin.end(document.getText())
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
        console.error(`shellcheck not available at path '${this.executablePath}'`)
        this._canLint = false
        return { comments: [] }
      }
      throw new Error(
        `shellcheck failed with code ${exit}: ${e}\nout:\n${out}\nerr:\n${err}`,
      )
    }

    let raw
    try {
      raw = JSON.parse(out)
    } catch (e) {
      throw new Error(
        `shellcheck: json parse failed with error ${e}\nout:\n${out}\nerr:\n${err}`,
      )
    }
    assertShellcheckResult(raw)
    return raw
  }
}

export type ShellcheckResult = Readonly<{
  comments: ReadonlyArray<ShellcheckComment>
}>

// Constituent structures defined here:
// https://github.com/koalaman/shellcheck/blob/4e703e5c61c6366bfd486d728bc624025e344e68/src/ShellCheck/Interface.hs#L221
export type ShellcheckComment = Readonly<{
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

export function assertShellcheckResult(val: any): asserts val is ShellcheckResult {
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

const severityMapping: Record<string, undefined | LSP.DiagnosticSeverity> = {
  error: LSP.DiagnosticSeverity.Error,
  warning: LSP.DiagnosticSeverity.Warning,
  info: LSP.DiagnosticSeverity.Information,
  style: LSP.DiagnosticSeverity.Hint,
}

// Severity mappings:
// https://github.com/koalaman/shellcheck/blob/364c33395e2f2d5500307f01989f70241c247d5a/src/ShellCheck/Formatter/Format.hs#L50
const mapSeverity = (sev: string) => severityMapping[sev] || LSP.DiagnosticSeverity.Error
