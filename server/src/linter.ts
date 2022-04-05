import { spawn } from 'child_process'
import * as LSP from 'vscode-languageserver'

function formatMessage(comment: any): string {
  return (comment.code ? `SC${comment.code}: ` : '') + comment.message
}

export default class Linter {
  private executablePath: string | null
  private canLint: boolean

  constructor({ executablePath }: { executablePath: string | null }) {
    this.executablePath = executablePath
    this.canLint = !!executablePath
  }

  public async lint(
    document: LSP.TextDocument,
    folders: LSP.WorkspaceFolder[],
  ): Promise<LSP.Diagnostic[]> {
    if (!this.executablePath || !this.canLint) return []

    const raw = await this.runShellcheck(this.executablePath, document, folders)
    if (!this.canLint) return []

    if (typeof raw != 'object')
      throw new Error(`shellcheck: unexpected json output ${typeof raw}`)

    if (!Array.isArray(raw.comments))
      throw new Error(
        `shellcheck: unexpected json output: expected 'comments' array ${typeof raw.comments}`,
      )

    const diags: LSP.Diagnostic[] = []
    for (const idx in raw.comments) {
      const comment = raw.comments[idx]
      if (typeof comment != 'object')
        throw new Error(
          `shellcheck: unexpected json comment at idx ${idx}: ${typeof comment}`,
        )

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
        severity: comment.level,
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
  ): Promise<any> {
    // FIXME: inject?
    const cwd = process.cwd()

    const args = ['--format=json1', '--external-sources', `--source-path=${cwd}`]
    for (const folder of folders) {
      args.push(`--source-path=${folder.name}`)
    }

    const proc = spawn(executablePath, [...args, '-'], { cwd })
    const onErr = new Promise((_, reject) =>
      proc.on('error', e => {
        if ((e as any).code === 'ENOENT') {
          // shellcheck path wasn't found, don't try to lint any more:
          console.error(`shellcheck not available at path '${this.executablePath}'`)
          this.canLint = false
        }
        reject(e)
      }),
    )

    proc.stdin.write(document.getText())
    proc.stdin.end()

    let out = ''
    for await (const chunk of proc.stdout) out += chunk

    let err = ''
    for await (const chunk of proc.stderr) err += chunk

    // XXX: do we care about exit code? 0 means "ok", 1 possibly means "errors",
    // but the presence of parseable errors in the output is also sufficient to
    // distinguish.
    await Promise.race([new Promise((resolve, _) => proc.on('close', resolve)), onErr])

    try {
      return JSON.parse(out)
    } catch (e) {
      throw new Error(
        `shellcheck: json parse failed with error ${e}\nout:\n${out}\nerr:\n${err}`,
      )
    }
  }
}
