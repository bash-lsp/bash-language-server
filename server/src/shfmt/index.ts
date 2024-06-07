import { spawn } from 'child_process'
import * as editorconfig from 'editorconfig'
import * as LSP from 'vscode-languageserver/node'
import { DocumentUri, TextDocument, TextEdit } from 'vscode-languageserver-textdocument'

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

  private async getShfmtArguments(
    documentUri: DocumentUri,
    formatOptions?: LSP.FormattingOptions | null,
    lspShfmtConfig?: Record<string, string | boolean> | null,
  ): Promise<string[]> {
    const args: string[] = []

    // this is the config that we'll use to build args - default to language server config
    let activeShfmtConfig = { ...lspShfmtConfig }

    // do we have a document stored on the local filesystem?
    const filepathMatch = documentUri.match(/^file:\/\/(.*)$/)
    if (filepathMatch) {
      const filepath = filepathMatch[1]
      args.push(`--filename=${filepathMatch[1]}`)

      if (!lspShfmtConfig?.ignoreEditorconfig) {
        const editorconfigProperties = await editorconfig.parse(filepath)
        logger.debug(
          `Shfmt: found .editorconfig properties: ${JSON.stringify(
            editorconfigProperties,
          )}`,
        )

        const editorconfigShfmtConfig: Record<string, any> = {}
        editorconfigShfmtConfig.binaryNextLine = editorconfigProperties.binary_next_line
        editorconfigShfmtConfig.caseIndent = editorconfigProperties.switch_case_indent
        editorconfigShfmtConfig.funcNextLine = editorconfigProperties.function_next_line
        editorconfigShfmtConfig.keepPadding = editorconfigProperties.keep_padding
        // --simplify is not supported via .editorconfig
        editorconfigShfmtConfig.spaceRedirects = editorconfigProperties.space_redirects
        editorconfigShfmtConfig.languageDialect = editorconfigProperties.shell_variant

        // if we have any shfmt-specific options in .editorconfig, use the config in .editorconfig and
        // ignore the language server config (this is similar to shfmt's approach of using either
        // .editorconfig or command line flags, but not both)
        if (
          editorconfigShfmtConfig.binaryNextLine !== undefined ||
          editorconfigShfmtConfig.caseIndent !== undefined ||
          editorconfigShfmtConfig.funcNextLine !== undefined ||
          editorconfigShfmtConfig.keepPadding !== undefined ||
          editorconfigShfmtConfig.spaceRedirects !== undefined ||
          editorconfigShfmtConfig.languageDialect !== undefined
        ) {
          logger.debug(
            'Shfmt: detected shfmt properties in .editorconfig - ignoring language server shfmt config',
          )
          activeShfmtConfig = { ...editorconfigShfmtConfig }
        } else {
          logger.debug(
            'Shfmt: no shfmt properties found in .editorconfig - using language server shfmt config',
          )
        }
      } else {
        logger.debug(
          'Shfmt: configured to ignore .editorconfig - using language server shfmt config',
        )
      }
    }

    // indentation always comes via the editor - if someone is using .editorconfig then the
    // expectation is that they will have configured their editor's indentation in this way too
    const indentation: number = formatOptions?.insertSpaces ? formatOptions.tabSize : 0
    args.push(`-i=${indentation}`) // --indent

    if (activeShfmtConfig?.binaryNextLine) args.push('-bn') // --binary-next-line
    if (activeShfmtConfig?.caseIndent) args.push('-ci') // --case-indent
    if (activeShfmtConfig?.funcNextLine) args.push('-fn') // --func-next-line
    if (activeShfmtConfig?.keepPadding) args.push('-kp') // --keep-padding
    if (activeShfmtConfig?.simplifyCode) args.push('-s') // --simplify
    if (activeShfmtConfig?.spaceRedirects) args.push('-sr') // --space-redirects
    if (activeShfmtConfig?.languageDialect)
      args.push(`-ln=${activeShfmtConfig.languageDialect}`) // --language-dialect

    return args
  }

  private async runShfmt(
    document: TextDocument,
    formatOptions?: LSP.FormattingOptions | null,
    shfmtConfig?: Record<string, string | boolean> | null,
  ): Promise<string> {
    const args = await this.getShfmtArguments(document.uri, formatOptions, shfmtConfig)

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
      proc.stdin.end(document.getText())
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
