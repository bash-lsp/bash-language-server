import { beforeAll, describe, expect, it, vi } from 'vitest'
import { FormattingOptions } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { FIXTURE_DOCUMENT, FIXTURE_FOLDER } from '../../../../testing/fixtures'
import { ShfmtConfig } from '../../config'
import { Logger } from '../../util/logger'
import { Formatter } from '../index'

vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {
  // noop
})
const loggerWarn = vi.spyOn(Logger.prototype, 'warn')

const FIXTURE_DOCUMENT_URI = `file://${FIXTURE_FOLDER}/foo.sh`
const SIMPLIFY_MINIFY_FIXTURE = `${FIXTURE_FOLDER}/shfmt-editorconfig/simplify-minify`
function textToDoc(txt: string) {
  return TextDocument.create(FIXTURE_DOCUMENT_URI, 'bar', 0, txt)
}

/** Fills the test shfmt configuration with default values */
function makeShfmtConfig(cfg: Partial<ShfmtConfig>): ShfmtConfig {
  return {
    path: cfg.path ?? '',
    additionalArguments: cfg.additionalArguments ?? [],
    ignoreEditorconfig: cfg.ignoreEditorconfig ?? false,
    languageDialect: cfg.languageDialect ?? 'auto',
    binaryNextLine: cfg.binaryNextLine ?? false,
    caseIndent: cfg.caseIndent ?? false,
    funcNextLine: cfg.funcNextLine ?? false,
    keepPadding: cfg.keepPadding ?? false,
    simplifyCode: cfg.simplifyCode ?? false,
    minify: cfg.minify ?? false,
    spaceRedirects: cfg.spaceRedirects ?? false,
  }
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
  shfmtConfig?: ShfmtConfig
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
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Shfmt: disabling formatting as no executable was found at path',
      ),
    )
  })

  it('should throw when formatting fails', async () => {
    await expect(async () => {
      await getFormattingResult({ document: FIXTURE_DOCUMENT.PARSE_PROBLEMS })
    }).rejects.toThrow(
      /Shfmt: exited with status 1: .*\/testing\/fixtures\/parse-problems.sh:10:1: [`"']?>[`"']? must be followed by a word/,
    )
  })

  it('should throw when parsing using the wrong language dialect', async () => {
    await expect(async () => {
      await getFormattingResult({
        document: FIXTURE_DOCUMENT.SHFMT,
        shfmtConfig: makeShfmtConfig({ languageDialect: 'posix' }),
      })
    }).rejects.toThrow(
      /Shfmt: exited with status 1: .*\/testing\/fixtures\/shfmt\.sh:25:14: (the [`"']?function[`"']? builtin|a command can only contain words and redirects; encountered \()/,
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
      shfmtConfig: makeShfmtConfig({ binaryNextLine: true }),
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
      shfmtConfig: makeShfmtConfig({ caseIndent: true }),
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
      shfmtConfig: makeShfmtConfig({ funcNextLine: true }),
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
      shfmtConfig: makeShfmtConfig({ keepPadding: true }),
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
      shfmtConfig: makeShfmtConfig({ simplifyCode: true }),
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
      shfmtConfig: makeShfmtConfig({ spaceRedirects: true }),
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
      shfmtConfig: makeShfmtConfig({
        binaryNextLine: true,
        caseIndent: true,
        funcNextLine: true,
        keepPadding: true,
        simplifyCode: true,
        spaceRedirects: true,
      }),
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

  it('should format with a combination of options and additionalArguments', async () => {
    const [result] = await getFormattingResult({
      document: FIXTURE_DOCUMENT.SHFMT,
      formatOptions: { tabSize: 2, insertSpaces: true },
      shfmtConfig: makeShfmtConfig({
        caseIndent: true,
        keepPadding: true,
        simplifyCode: true,
        spaceRedirects: true,
        additionalArguments: ['--binary-next-line', '--func-next-line'],
      }),
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

    await expect(async () => {
      await getFormattingResult({ document: testDocument })
    }).rejects.toThrow(
      /Shfmt: exited with status 1: <standard input>:10:1: [`"']?>[`"']? must be followed by a word/,
    )
  })

  it('minifies and simplifies code when the language-server minify setting is true', async () => {
    const [result] = await getFormattingResult({
      document: textToDoc(
        '# comment\nif [[ "$value" == "value" ]]; then\n  echo "matched"\nfi\n',
      ),
      shfmtConfig: makeShfmtConfig({ minify: true, simplifyCode: false }),
    })

    expect(result).toHaveLength(1)
    expect(result[0].newText).toEqual(
      'if [[ $value == "value" ]];then\necho "matched"\nfi\n',
    )
  })

  describe('EditorConfig simplify and minify formatting', () => {
    const input =
      '# comment\nif [[ "$value" == "value" ]]; then\n    echo "matched"\nfi\n'
    const formatted =
      '# comment\nif [[ "$value" == "value" ]]; then\n  echo "matched"\nfi\n'
    const simplified =
      '# comment\nif [[ $value == "value" ]]; then\n  echo "matched"\nfi\n'
    const minified = 'if [[ $value == "value" ]];then\necho "matched"\nfi\n'

    it.each([
      ['simplify-true.sh', simplified],
      ['minify-true.sh', minified],
      ['minify-without-simplify.sh', minified],
      ['unset/simplify-true.sh', formatted],
      ['unset/minify-true.sh', formatted],
    ])('formats %s using EditorConfig', async (filename, expected) => {
      const [result] = await getFormattingResult({
        document: TextDocument.create(
          `file://${SIMPLIFY_MINIFY_FIXTURE}/${filename}`,
          'shellscript',
          0,
          input,
        ),
        formatOptions: { tabSize: 2, insertSpaces: true },
        shfmtConfig: makeShfmtConfig({}),
      })

      expect(result).toHaveLength(1)
      expect(result[0].newText).toEqual(expected)
    })
  })

  describe('getShfmtArguments()', () => {
    const lspShfmtConfig = makeShfmtConfig({
      binaryNextLine: true,
      funcNextLine: true,
      additionalArguments: ['-s'],
    })
    const lspShfmtArgs = ['-bn', '-fn', '-s']
    const formatOptions = { tabSize: 2, insertSpaces: true }

    const formatter = new Formatter({
      executablePath: 'shfmt',
    })

    it('preserves additionalArguments across formatting requests', async () => {
      const shfmtConfig = makeShfmtConfig({ additionalArguments: ['-s'] })
      const uri = `file://${FIXTURE_FOLDER}/shfmt.sh`

      // @ts-expect-error Testing a private method
      const firstArgs = await formatter.getShfmtArguments(uri, formatOptions, shfmtConfig)
      // @ts-expect-error Testing a private method
      const secondArgs = await formatter.getShfmtArguments(
        uri,
        formatOptions,
        shfmtConfig,
      )

      expect(shfmtConfig.additionalArguments).toEqual(['-s'])
      expect(firstArgs).toEqual([
        '-s',
        `--filename=${FIXTURE_FOLDER}/shfmt.sh`,
        '-i=2',
        '-ln=auto',
      ])
      expect(secondArgs).toEqual(firstArgs)
    })

    describe('EditorConfig simplify and minify arguments', () => {
      const shfmtConfig = makeShfmtConfig({
        binaryNextLine: true,
        funcNextLine: true,
        simplifyCode: true,
        minify: true,
        additionalArguments: ['-i=8', '-ci'],
      })

      it.each([
        ['simplify-true.sh', ['-s']],
        ['simplify-false.sh', []],
        ['minify-true.sh', ['-mn']],
        ['minify-false.sh', []],
        ['both-true.sh', ['-s', '-mn']],
        ['minify-without-simplify.sh', ['-mn']],
        ['unset/minify-without-simplify.sh', []],
      ])(
        'uses %s instead of language-server settings and preserves additional arguments and editor indentation',
        async (filename, flags) => {
          const filepath = `${SIMPLIFY_MINIFY_FIXTURE}/${filename}`

          // @ts-expect-error Testing a private method
          const args = await formatter.getShfmtArguments(
            `file://${filepath}`,
            formatOptions,
            shfmtConfig,
          )

          expect(args).toEqual([
            '-i=8',
            '-ci',
            `--filename=${filepath}`,
            '-i=2',
            ...flags,
          ])
          expect(shfmtConfig.additionalArguments).toEqual(['-i=8', '-ci'])
        },
      )

      it.each([
        'simplify-true.sh',
        'minify-true.sh',
        'both-true.sh',
        'other-properties.sh',
      ])(
        'uses language-server settings when %s unsets all EditorConfig shfmt properties',
        async (filename) => {
          const filepath = `${SIMPLIFY_MINIFY_FIXTURE}/unset/${filename}`

          // @ts-expect-error Testing a private method
          const args = await formatter.getShfmtArguments(
            `file://${filepath}`,
            formatOptions,
            shfmtConfig,
          )

          expect(args).toEqual([
            '-i=8',
            '-ci',
            `--filename=${filepath}`,
            '-i=2',
            '-bn',
            '-fn',
            '-s',
            '-mn',
            '-ln=auto',
          ])
        },
      )

      it.each([
        ['both-true.sh', false, []],
        ['minify-false.sh', true, ['-mn']],
      ])(
        'uses language-server minify settings when ignoring %s',
        async (filename, minify, flags) => {
          const filepath = `${SIMPLIFY_MINIFY_FIXTURE}/${filename}`

          // @ts-expect-error Testing a private method
          const args = await formatter.getShfmtArguments(
            `file://${filepath}`,
            formatOptions,
            { ...shfmtConfig, simplifyCode: false, minify, ignoreEditorconfig: true },
          )

          expect(args).toEqual([
            '-i=8',
            '-ci',
            `--filename=${filepath}`,
            '-i=2',
            '-bn',
            '-fn',
            ...flags,
            '-ln=auto',
          ])
        },
      )
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
        expect(shfmtArgs.length).toEqual(5) // indentation
      })

      it('should contain additionalArguments', async () => {
        expect(shfmtArgs).toEqual(
          expect.arrayContaining(lspShfmtConfig.additionalArguments),
        )
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
        expect(shfmtArgs.length).toEqual(6) // indentation + filename
      })

      it('should contain additionalArguments', async () => {
        expect(shfmtArgs).toEqual(
          expect.arrayContaining(lspShfmtConfig.additionalArguments),
        )
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
        expect(shfmtArgs.length).toEqual(6) // indentation + filename
      })

      it('should contain additionalArguments', async () => {
        expect(shfmtArgs).toEqual(
          expect.arrayContaining(lspShfmtConfig.additionalArguments),
        )
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
        expect(shfmtArgs).toContain('-s') // additionalArguments still apply
        expect(shfmtArgs.length).toEqual(3) // additionalArguments + indentation + filename
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
        expect(shfmtArgs).toEqual(
          expect.arrayContaining(['-s', '-ci', '-sr', "-ln='mksh'"]),
        )
        expect(shfmtArgs.length).toEqual(6) // additionalArguments + indentation + filename
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
        expect(shfmtArgs.length).toEqual(6) // indentation + filename
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
