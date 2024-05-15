import { basename, relative } from 'node:path'
import { format } from 'node:util'

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
    const result = await this.runShfmt(document, formatOptions, shfmtConfig)

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
    document: TextDocument,
    formatOptions?: LSP.FormattingOptions | null,
    shfmtConfig?: Record<string, string | boolean> | null,
  ): Promise<string> {
    // documentText: string,
    const documentText = document.getText()
    const documentUri = document.uri
    let filepath = documentUri.substring(7) // trim "files://"
    filepath = relative(this.cwd, filepath)

    // Do not pass any Parser and Printer options like -i/-p/-bn/-l. It will cause the .editorconfig not to be loaded.
    // See https://github.com/mvdan/sh/blob/23633a432f903599a4ce46c30c4337e413a26ef1/cmd/shfmt/main.go#L186-L196
    const args: string[] = [
      `--filename=${filepath}`, // Must set filename for matching the rules in .editorconfig.
    ]

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

    let exit
    try {
      exit = await proc
    } catch (e) {
      if ((e as any).code === 'ENOENT') {
        // shfmt path wasn't found, don't try to format any more:
        logger.warn(
          `Shfmt: disabling formatting as no executable was found at path '${this.executablePath}'`,
        )
        this._canFormat = false
        return ''
      }
      throw new Error(`Shfmt: child process error: ${e}`)
    }

    if (exit != 0) {
      throw new Error(`Shfmt: exited with status ${exit}: ${err}`)
    }

    return out
  }
}
