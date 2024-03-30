import { spawn } from 'child_process'
import * as LSP from 'vscode-languageserver/node'
import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument'

import { logger } from '../util/logger'

type FormatterOptions = {
  executablePath: string
  cwd?: string
}

export class Formatter {
  private cwd: string
  public executablePath: string
  private _canFormat: boolean

  constructor({ cwd, executablePath }: FormatterOptions) {
    this._canFormat = true
    this.cwd = cwd || process.cwd()
    this.executablePath = executablePath
  }

  public get canFormat(): boolean {
    return this._canFormat
  }

  public async format(
    document: TextDocument,
    formatOptions?: LSP.FormattingOptions | null,
    shfmtConfig?: Record<string, string | boolean> | null,
  ): Promise<TextEdit[]> {
    if (!this._canFormat) {
      return []
    }

    return this.executeFormat(document, formatOptions, shfmtConfig)
  }

  private async executeFormat(
    document: TextDocument,
    formatOptions?: LSP.FormattingOptions | null,
    shfmtConfig?: Record<string, string | boolean> | null,
  ): Promise<TextEdit[]> {
    const documentText = document.getText()

    const result = await this.runShfmt(documentText, formatOptions, shfmtConfig)

    if (!this._canFormat) {
      return []
    }

    return [
      {
        range: LSP.Range.create(
          LSP.Position.create(0, 0),
          LSP.Position.create(Number.MAX_VALUE, Number.MAX_VALUE),
        ),
        newText: result,
      },
    ]
  }

  private async runShfmt(
    documentText: string,
    formatOptions?: LSP.FormattingOptions | null,
    shfmtConfig?: Record<string, string | boolean> | null,
  ): Promise<string> {
    const indentation: number = formatOptions?.insertSpaces ? formatOptions.tabSize : 0
    const args: string[] = [`--indent=${indentation}`]
    if (shfmtConfig?.binaryNextLine) args.push('--binary-next-line')
    if (shfmtConfig?.caseIndent) args.push('--case-indent')
    if (shfmtConfig?.funcNextLine) args.push('--func-next-line')
    if (shfmtConfig?.spaceRedirects) args.push('--space-redirects')

    logger.debug(`Shfmt: running "${this.executablePath} ${args.join(' ')}"`)

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
        // shfmt path wasn't found, don't try to format any more:
        logger.warn(
          `Shfmt: disabling formatting as no executable was found at path '${this.executablePath}'`,
        )
        this._canFormat = false
        return ''
      }
      throw new Error(`Shfmt: failed with code ${exit}: ${e}\nout:\n${out}\nerr:\n${err}`)
    }

    return out
  }
}
