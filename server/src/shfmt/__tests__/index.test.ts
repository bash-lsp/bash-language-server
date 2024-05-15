import { FormattingOptions } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { FIXTURE_DOCUMENT, FIXTURE_FOLDER } from '../../../../testing/fixtures'
import { Logger } from '../../util/logger'
import { Formatter } from '../index'

jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {
  // noop
})
const loggerWarn = jest.spyOn(Logger.prototype, 'warn')

const FIXTURE_DOCUMENT_URI = `file://${FIXTURE_FOLDER}/foo.sh`
function textToDoc(txt: string) {
  return TextDocument.create(FIXTURE_DOCUMENT_URI, 'bar', 0, txt)
}

async function getFormattingResult({
  document,
  executablePath = 'shfmt',
  formatOptions,
  shfmtConfig,
}: {
  document: TextDocument
  executablePath?: string
  formatOptions?: FormattingOptions
  shfmtConfig?: Record<string, string | boolean>
}): Promise<[Awaited<ReturnType<Formatter['format']>>, Formatter]> {
  const formatter = new Formatter({
    executablePath,
  })
  const result = await formatter.format(document, formatOptions, shfmtConfig)
  return [result, formatter]
}

describe('formatter', () => {
  it('defaults canFormat to true', () => {
    expect(new Formatter({ executablePath: 'foo' }).canFormat).toBe(true)
  })

  it('should set canFormat to false when the executable cannot be found', async () => {
    const [result, formatter] = await getFormattingResult({
      document: textToDoc(''),
      executablePath: 'foo',
    })

    expect(result).toEqual([])

    expect(formatter.canFormat).toBe(false)
    expect(loggerWarn).toBeCalledWith(
      expect.stringContaining(
        'Shfmt: disabling formatting as no executable was found at path',
      ),
    )
  })

  it('should throw when formatting fails', async () => {
    expect(async () => {
      await getFormattingResult({ document: FIXTURE_DOCUMENT.PARSE_PROBLEMS })
    }).rejects.toThrow(
      'Shfmt: exited with status 1: <standard input>:10:1: > must be followed by a word',
    )
  })

  it('should format when shfmt is present', async () => {
    const [result] = await getFormattingResult({ document: FIXTURE_DOCUMENT.SHFMT })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "newText": "#!/bin/bash
      set -ueo pipefail

      if [ -z "$arg" ]; then
      	echo indent
      fi

      echo binary &&
      	echo next line

      case "$arg" in
      a)
      	echo case indent
      	;;
      esac

      echo space redirects >/dev/null

      function next() {
      	echo line
      }
      ",
          "range": {
            "end": {
              "character": 2147483647,
              "line": 2147483647,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
        },
      ]
    `)
  })

  it('should format using tabs when insertSpaces is false', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 4, insertSpaces: false },
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "newText": "#!/bin/bash
      set -ueo pipefail

      if [ -z "$arg" ]; then
      	echo indent
      fi

      echo binary &&
      	echo next line

      case "$arg" in
      a)
      	echo case indent
      	;;
      esac

      echo space redirects >/dev/null

      function next() {
      	echo line
      }
      ",
          "range": {
            "end": {
              "character": 2147483647,
              "line": 2147483647,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
        },
      ]
    `)
  })

  it('should format using spaces when insertSpaces is true', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 3, insertSpaces: true },
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "newText": "#!/bin/bash
      set -ueo pipefail

      if [ -z "$arg" ]; then
         echo indent
      fi

      echo binary &&
         echo next line

      case "$arg" in
      a)
         echo case indent
         ;;
      esac

      echo space redirects >/dev/null

      function next() {
         echo line
      }
      ",
          "range": {
            "end": {
              "character": 2147483647,
              "line": 2147483647,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
        },
      ]
    `)
  })

  it('should format with operators at the start of the line when binaryNextLine is true', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 2, insertSpaces: true },
      shfmtConfig: { binaryNextLine: true },
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "newText": "#!/bin/bash
      set -ueo pipefail

      if [ -z "$arg" ]; then
        echo indent
      fi

      echo binary \\
        && echo next line

      case "$arg" in
      a)
        echo case indent
        ;;
      esac

      echo space redirects >/dev/null

      function next() {
        echo line
      }
      ",
          "range": {
            "end": {
              "character": 2147483647,
              "line": 2147483647,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
        },
      ]
    `)
  })

  it('should format with case patterns indented when caseIndent is true', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 2, insertSpaces: true },
      shfmtConfig: { caseIndent: true },
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "newText": "#!/bin/bash
      set -ueo pipefail

      if [ -z "$arg" ]; then
        echo indent
      fi

      echo binary &&
        echo next line

      case "$arg" in
        a)
          echo case indent
          ;;
      esac

      echo space redirects >/dev/null

      function next() {
        echo line
      }
      ",
          "range": {
            "end": {
              "character": 2147483647,
              "line": 2147483647,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
        },
      ]
    `)
  })

  it('should format with function opening braces on a separate line when funcNextLine is true', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 2, insertSpaces: true },
      shfmtConfig: { funcNextLine: true },
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "newText": "#!/bin/bash
      set -ueo pipefail

      if [ -z "$arg" ]; then
        echo indent
      fi

      echo binary &&
        echo next line

      case "$arg" in
      a)
        echo case indent
        ;;
      esac

      echo space redirects >/dev/null

      function next()
      {
        echo line
      }
      ",
          "range": {
            "end": {
              "character": 2147483647,
              "line": 2147483647,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
        },
      ]
    `)
  })

  it('should format with redirect operators followed by a space when spaceRedirects is true', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 2, insertSpaces: true },
      shfmtConfig: { spaceRedirects: true },
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "newText": "#!/bin/bash
      set -ueo pipefail

      if [ -z "$arg" ]; then
        echo indent
      fi

      echo binary &&
        echo next line

      case "$arg" in
      a)
        echo case indent
        ;;
      esac

      echo space redirects > /dev/null

      function next() {
        echo line
      }
      ",
          "range": {
            "end": {
              "character": 2147483647,
              "line": 2147483647,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
        },
      ]
    `)
  })

  it('should format with all options enabled when multiple config settings are combined', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 2, insertSpaces: true },
      shfmtConfig: {
        binaryNextLine: true,
        caseIndent: true,
        funcNextLine: true,
        spaceRedirects: true,
      },
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "newText": "#!/bin/bash
      set -ueo pipefail

      if [ -z "$arg" ]; then
        echo indent
      fi

      echo binary \\
        && echo next line

      case "$arg" in
        a)
          echo case indent
          ;;
      esac

      echo space redirects > /dev/null

      function next()
      {
        echo line
      }
      ",
          "range": {
            "end": {
              "character": 2147483647,
              "line": 2147483647,
            },
            "start": {
              "character": 0,
              "line": 0,
            },
          },
        },
      ]
    `)
  })
})
