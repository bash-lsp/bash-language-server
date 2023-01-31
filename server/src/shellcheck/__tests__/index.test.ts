import * as path from 'path'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { FIXTURE_DOCUMENT, FIXTURE_FOLDER } from '../../../../testing/fixtures'
import { Logger } from '../../util/logger'
import { Linter } from '../index'

jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {
  // noop
})
const loggerWarn = jest.spyOn(Logger.prototype, 'warn')

jest.useFakeTimers()

const FIXTURE_DOCUMENT_URI = `file://${FIXTURE_FOLDER}/foo.sh`
function textToDoc(txt: string) {
  return TextDocument.create(FIXTURE_DOCUMENT_URI, 'bar', 0, txt)
}

async function getLintingResult({
  additionalShellCheckArguments = [],
  cwd,
  document,
  executablePath = 'shellcheck',
  sourcePaths = [],
}: {
  additionalShellCheckArguments?: string[]
  cwd?: string
  document: TextDocument
  executablePath?: string
  sourcePaths?: string[]
}): Promise<[Awaited<ReturnType<Linter['lint']>>, Linter]> {
  const linter = new Linter({
    cwd,
    executablePath,
  })
  const promise = linter.lint(document, sourcePaths, additionalShellCheckArguments)
  jest.runAllTimers()
  const result = await promise
  return [result, linter]
}

describe('linter', () => {
  it('default to canLint to true', () => {
    expect(new Linter({ executablePath: 'foo' }).canLint).toBe(true)
  })

  it('should set canLint to false when linting fails', async () => {
    const executablePath = '77b4d3f6-c87a-11ec-9b62-a3c90f66d29f'

    const [result, linter] = await getLintingResult({
      document: textToDoc(''),
      executablePath,
    })

    expect(result).toEqual({
      codeActions: {},
      diagnostics: [],
    })

    expect(linter.canLint).toBe(false)
    expect(loggerWarn).toBeCalledWith(
      expect.stringContaining(
        'ShellCheck: disabling linting as no executable was found at path',
      ),
    )
  })

  it('should lint when shellcheck is present', async () => {
    // prettier-ignore
    const shell = [
      '#!/bin/bash',
      'echo $foo',
    ].join('\n')

    const [result] = await getLintingResult({ document: textToDoc(shell) })
    expect(result).toMatchInlineSnapshot(`
      {
        "codeActions": {
          "shellcheck|2086|1:5-1:9": {
            "diagnostics": [
              {
                "code": "SC2086",
                "codeDescription": {
                  "href": "https://www.shellcheck.net/wiki/SC2086",
                },
                "data": {
                  "id": "shellcheck|2086|1:5-1:9",
                },
                "message": "Double quote to prevent globbing and word splitting.",
                "range": {
                  "end": {
                    "character": 9,
                    "line": 1,
                  },
                  "start": {
                    "character": 5,
                    "line": 1,
                  },
                },
                "severity": 3,
                "source": "shellcheck",
                "tags": undefined,
              },
            ],
            "edit": {
              "changes": {
                "${FIXTURE_DOCUMENT_URI}": [
                  {
                    "newText": """,
                    "range": {
                      "end": {
                        "character": 9,
                        "line": 1,
                      },
                      "start": {
                        "character": 9,
                        "line": 1,
                      },
                    },
                  },
                  {
                    "newText": """,
                    "range": {
                      "end": {
                        "character": 5,
                        "line": 1,
                      },
                      "start": {
                        "character": 5,
                        "line": 1,
                      },
                    },
                  },
                ],
              },
            },
            "kind": "quickfix",
            "title": "Apply fix for SC2086",
          },
        },
        "diagnostics": [
          {
            "code": "SC2154",
            "codeDescription": {
              "href": "https://www.shellcheck.net/wiki/SC2154",
            },
            "data": {
              "id": "shellcheck|2154|1:5-1:9",
            },
            "message": "foo is referenced but not assigned.",
            "range": {
              "end": {
                "character": 9,
                "line": 1,
              },
              "start": {
                "character": 5,
                "line": 1,
              },
            },
            "severity": 2,
            "source": "shellcheck",
            "tags": undefined,
          },
          {
            "code": "SC2086",
            "codeDescription": {
              "href": "https://www.shellcheck.net/wiki/SC2086",
            },
            "data": {
              "id": "shellcheck|2086|1:5-1:9",
            },
            "message": "Double quote to prevent globbing and word splitting.",
            "range": {
              "end": {
                "character": 9,
                "line": 1,
              },
              "start": {
                "character": 5,
                "line": 1,
              },
            },
            "severity": 3,
            "source": "shellcheck",
            "tags": undefined,
          },
        ],
      }
    `)
  })

  it('should debounce the lint requests', async () => {
    const linter = new Linter({
      cwd: FIXTURE_FOLDER,
      executablePath: 'shellcheck',
    })

    const lintCalls = 100
    const promises = [...Array(lintCalls)].map(() =>
      linter.lint(FIXTURE_DOCUMENT.SHELLCHECK_SOURCE, []),
    )

    jest.runOnlyPendingTimers()

    const result = await promises[promises.length - 1]
    expect(result).toEqual({
      codeActions: {},
      diagnostics: [],
    })
  })

  it('should correctly follow sources with correct cwd', async () => {
    const [result] = await getLintingResult({
      cwd: FIXTURE_FOLDER,
      document: FIXTURE_DOCUMENT.SHELLCHECK_SOURCE,
    })

    expect(result).toEqual({
      codeActions: {},
      diagnostics: [],
    })
  })

  it('should fail to follow sources with incorrect cwd', async () => {
    const [result] = await getLintingResult({
      cwd: path.resolve(path.join(FIXTURE_FOLDER, '../')),
      document: FIXTURE_DOCUMENT.SHELLCHECK_SOURCE,
    })

    expect(result).toMatchInlineSnapshot(`
      {
        "codeActions": {},
        "diagnostics": [
          {
            "code": "SC1091",
            "codeDescription": {
              "href": "https://www.shellcheck.net/wiki/SC1091",
            },
            "data": {
              "id": "shellcheck|1091|3:7-3:19",
            },
            "message": "Not following: shellcheck/sourced.sh: openBinaryFile: does not exist (No such file or directory)",
            "range": {
              "end": {
                "character": 19,
                "line": 3,
              },
              "start": {
                "character": 7,
                "line": 3,
              },
            },
            "severity": 3,
            "source": "shellcheck",
            "tags": undefined,
          },
          {
            "code": "SC2154",
            "codeDescription": {
              "href": "https://www.shellcheck.net/wiki/SC2154",
            },
            "data": {
              "id": "shellcheck|2154|5:6-5:10",
            },
            "message": "foo is referenced but not assigned.",
            "range": {
              "end": {
                "character": 10,
                "line": 5,
              },
              "start": {
                "character": 6,
                "line": 5,
              },
            },
            "severity": 2,
            "source": "shellcheck",
            "tags": undefined,
          },
        ],
      }
    `)
  })

  it('should follow sources with incorrect cwd if the execution path is passed', async () => {
    const [result] = await getLintingResult({
      cwd: path.resolve(path.join(FIXTURE_FOLDER, '../')),
      document: FIXTURE_DOCUMENT.SHELLCHECK_SOURCE,
      sourcePaths: [path.resolve(FIXTURE_FOLDER)],
    })
    expect(result).toEqual({
      codeActions: {},
      diagnostics: [],
    })
  })
})
