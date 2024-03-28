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
}: {
  document: TextDocument
  executablePath?: string
}): Promise<[Awaited<ReturnType<Formatter['format']>>, Formatter]> {
  const formatter = new Formatter({
    executablePath,
  })
  const result = await formatter.format(document)
  return [result, formatter]
}

describe('formatter', () => {
  it('defaults canFormat to true', () => {
    expect(new Formatter({ executablePath: 'foo' }).canFormat).toBe(true)
  })

  it('should set canFormat to false when formatting fails', async () => {
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
})
