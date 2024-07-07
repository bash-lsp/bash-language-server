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
      /Shfmt: exited with status 1: .*\/testing\/fixtures\/parse-problems.sh:10:1: > must be followed by a word/,
    )
  })

  it('should throw when parsing using the wrong language dialect', async () => {
    expect(async () => {
      await getFormattingResult({
        document: FIXTURE_DOCUMENT.SHFMT,
        shfmtConfig: { languageDialect: 'posix' },
      })
    }).rejects.toThrow(
      /Shfmt: exited with status 1: .*\/testing\/fixtures\/shfmt\.sh:25:14: (the "function" builtin exists in bash; tried parsing as posix|a command can only contain words and redirects; encountered \()/,
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

      echo one two three
      echo four five six
      echo seven eight nine

      [[ "$simplify" == "simplify" ]]

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

      echo one two three
      echo four five six
      echo seven eight nine

      [[ "$simplify" == "simplify" ]]

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

      echo one two three
      echo four five six
      echo seven eight nine

      [[ "$simplify" == "simplify" ]]

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

      echo one two three
      echo four five six
      echo seven eight nine

      [[ "$simplify" == "simplify" ]]

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

      echo one two three
      echo four five six
      echo seven eight nine

      [[ "$simplify" == "simplify" ]]

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

      echo one two three
      echo four five six
      echo seven eight nine

      [[ "$simplify" == "simplify" ]]

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

  it('should format with padding kept as-is when keepPadding is true', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 2, insertSpaces: true },
      shfmtConfig: { keepPadding: true },
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

      echo one   two   three
      echo four  five  six
      echo seven eight nine

      [[ "$simplify" == "simplify" ]]

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

  it('should format after simplifying the code when simplifyCode is true', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 2, insertSpaces: true },
      shfmtConfig: { simplifyCode: true },
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

      echo one two three
      echo four five six
      echo seven eight nine

      [[ $simplify == "simplify" ]]

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

      echo one two three
      echo four five six
      echo seven eight nine

      [[ "$simplify" == "simplify" ]]

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
        keepPadding: true,
        simplifyCode: true,
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

      echo one   two   three
      echo four  five  six
      echo seven eight nine

      [[ $simplify == "simplify"   ]]

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

  it('should omit filename from the shfmt command when it cannot be determined', async () => {
    // There's no easy way to see what filename has been passed to shfmt without inspecting the
    // contents of the logs. As a workaround, we set a non-file:// URI on a dodgy document to
    // trigger an exception and inspect the error message.
    const testDocument = TextDocument.create(
      'http://localhost/',
      'shellscript',
      0,
      FIXTURE_DOCUMENT.PARSE_PROBLEMS.getText(),
    )

    expect(async () => {
      await getFormattingResult({ document: testDocument })
    }).rejects.toThrow(
      /Shfmt: exited with status 1: <standard input>:10:1: > must be followed by a word/,
    )
  })

  describe('getShfmtArguments()', () => {
    const lspShfmtConfig = {
      binaryNextLine: true,
      funcNextLine: true,
      simplifyCode: true,
    }
    const lspShfmtArgs = ['-bn', '-fn', '-s']
    const formatOptions = { tabSize: 2, insertSpaces: true }

    const formatter = new Formatter({
      executablePath: 'shfmt',
    })

    describe('when the document URI is not a filepath', () => {
      let shfmtArgs: string[]
      const filepath = `${FIXTURE_FOLDER}/shfmt.sh`

      beforeAll(async () => {
        // @ts-expect-error Testing a private method
        shfmtArgs = await formatter.getShfmtArguments(
          `test://${filepath}`,
          formatOptions,
          lspShfmtConfig,
        )
      })

      it('should use language server config', async () => {
        expect(shfmtArgs).toEqual(expect.arrayContaining(lspShfmtArgs))
        expect(shfmtArgs.length).toEqual(4) // indentation
      })

      it('should use indentation config from the editor', () => {
        expect(shfmtArgs).toContain('-i=2')
      })

      it('should not include the filename argument', async () => {
        expect(shfmtArgs).not.toContain(`--filename=${filepath}`)
      })
    })

    describe('when no .editorconfig exists', () => {
      let shfmtArgs: string[]
      const filepath = `${FIXTURE_FOLDER}/shfmt.sh`

      beforeAll(async () => {
        // @ts-expect-error Testing a private method
        shfmtArgs = await formatter.getShfmtArguments(
          `file://${filepath}`,
          formatOptions,
          lspShfmtConfig,
        )
      })

      it('should use language server config', () => {
        expect(shfmtArgs).toEqual(expect.arrayContaining(lspShfmtArgs))
        expect(shfmtArgs.length).toEqual(5) // indentation + filename
      })

      it('should use indentation config from the editor', () => {
        expect(shfmtArgs).toContain('-i=2')
      })

      it('should include the filename argument', () => {
        expect(shfmtArgs).toContain(`--filename=${filepath}`)
      })
    })

    describe('when an .editorconfig exists without shfmt options', () => {
      let shfmtArgs: string[]
      const filepath = `${FIXTURE_FOLDER}/shfmt-editorconfig/no-shfmt-properties/foo.sh`

      beforeAll(async () => {
        // @ts-expect-error Testing a private method
        shfmtArgs = await formatter.getShfmtArguments(
          `file://${filepath}`,
          formatOptions,
          lspShfmtConfig,
        )
      })

      it('should use language server config', () => {
        expect(shfmtArgs).toEqual(expect.arrayContaining(lspShfmtArgs))
        expect(shfmtArgs.length).toEqual(5) // indentation + filename
      })

      it('should use indentation config from the editor', () => {
        expect(shfmtArgs).toContain('-i=2')
      })

      it('should include the filename argument', () => {
        expect(shfmtArgs).toContain(`--filename=${filepath}`)
      })
    })

    describe('when an .editorconfig exists and contains only false shfmt options', () => {
      let shfmtArgs: string[]
      const filepath = `${FIXTURE_FOLDER}/shfmt-editorconfig/shfmt-properties-false/foo.sh`

      beforeAll(async () => {
        // @ts-expect-error Testing a private method
        shfmtArgs = await formatter.getShfmtArguments(
          `file://${filepath}`,
          formatOptions,
          lspShfmtConfig,
        )
      })

      it('should use .editorconfig config (even though no options are enabled)', () => {
        expect(shfmtArgs.length).toEqual(2) // indentation + filename
      })

      it('should use indentation config from the editor', () => {
        expect(shfmtArgs).toContain('-i=2')
      })

      it('should include the filename argument', () => {
        expect(shfmtArgs).toContain(`--filename=${filepath}`)
      })
    })

    describe('when an .editorconfig exists and contains one or more shfmt options', () => {
      let shfmtArgs: string[]
      const filepath = `${FIXTURE_FOLDER}/shfmt-editorconfig/shfmt-properties/foo.sh`

      beforeAll(async () => {
        // @ts-expect-error Testing a private method
        shfmtArgs = await formatter.getShfmtArguments(
          `file://${filepath}`,
          formatOptions,
          lspShfmtConfig,
        )
      })

      it('should use .editorconfig config', () => {
        expect(shfmtArgs).toEqual(expect.arrayContaining(['-ci', '-sr', "-ln='mksh'"]))
        expect(shfmtArgs.length).toEqual(5) // indentation + filename
      })

      it('should use indentation config from the editor', () => {
        expect(shfmtArgs).toContain('-i=2')
      })

      it('should include the filename argument', () => {
        expect(shfmtArgs).toContain(`--filename=${filepath}`)
      })
    })

    describe('when an .editorconfig exists but ignoreEditorconfig is set', () => {
      let shfmtArgs: string[]
      const filepath = `${FIXTURE_FOLDER}/shfmt-editorconfig/shfmt-properties/foo.sh`

      beforeAll(async () => {
        // @ts-expect-error Testing a private method
        shfmtArgs = await formatter.getShfmtArguments(
          `file://${filepath}`,
          formatOptions,
          { ...lspShfmtConfig, ignoreEditorconfig: true },
        )
      })

      it('should use language server config', () => {
        expect(shfmtArgs).toEqual(expect.arrayContaining(lspShfmtArgs))
        expect(shfmtArgs.length).toEqual(5) // indentation + filename
      })

      it('should use indentation config from the editor', () => {
        expect(shfmtArgs).toContain('-i=2')
      })

      it('should include the filename argument', () => {
        expect(shfmtArgs).toContain(`--filename=${filepath}`)
      })
    })
  })
})
