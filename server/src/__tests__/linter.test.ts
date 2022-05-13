import * as path from 'path'
import * as LSP from 'vscode-languageserver'

import { FIXTURE_DOCUMENT, FIXTURE_FOLDER } from '../../../testing/fixtures'
import Linter, { assertShellcheckResult } from '../linter'

function textToDoc(txt: string) {
  return LSP.TextDocument.create('foo', 'bar', 0, txt)
}

describe('linter', () => {
  it('should set canLint to false if executable empty', () => {
    expect(new Linter({ executablePath: null }).canLint).toBe(false)
  })

  it('should set canLint to true if executable not empty', () => {
    expect(new Linter({ executablePath: null }).canLint).toBe(false)
  })

  it('should set canLint to false when linting fails', async () => {
    jest.spyOn(console, 'error').mockImplementation()
    const executablePath = '77b4d3f6-c87a-11ec-9b62-a3c90f66d29f'
    const linter = new Linter({
      executablePath,
    })
    expect(await linter.lint(textToDoc(''), [])).toEqual([])
    expect(linter.canLint).toBe(false)
    expect(console.error).toBeCalledWith(
      expect.stringContaining('shellcheck not available at path'),
    )
  })

  it('should lint when shellcheck present', async () => {
    // prettier-ignore
    const shell = [
      '#!/bin/bash',
      'echo $foo',
    ].join('\n')

    const expected: LSP.Diagnostic[] = [
      {
        message: 'SC2154: foo is referenced but not assigned.',
        severity: 2,
        code: 2154,
        source: 'shellcheck',
        range: { start: { line: 1, character: 5 }, end: { line: 1, character: 9 } },
      },
      {
        message: 'SC2086: Double quote to prevent globbing and word splitting.',
        severity: 3,
        code: 2086,
        source: 'shellcheck',
        range: { start: { line: 1, character: 5 }, end: { line: 1, character: 9 } },
      },
    ]

    const linter = new Linter({ executablePath: 'shellcheck' })
    const result = await linter.lint(textToDoc(shell), [])
    expect(result).toEqual(expected)
  })

  it('should correctly follow sources with correct cwd', async () => {
    const linter = new Linter({ executablePath: 'shellcheck', cwd: FIXTURE_FOLDER })
    const result = await linter.lint(FIXTURE_DOCUMENT.SHELLCHECK_SOURCE, [])
    expect(result).toEqual([])
  })

  it('should fail to follow sources with incorrect cwd', async () => {
    const linter = new Linter({
      executablePath: 'shellcheck',
      cwd: path.resolve(path.join(FIXTURE_FOLDER, '../')),
    })
    // prettier-ignore
    const expected = [
      { message: 'SC1091: Not following: shellcheck/sourced.sh: openBinaryFile: does not exist (No such file or directory)', severity: 3, code: 1091, source: 'shellcheck', range: { start: { line: 3, character: 7 }, end: { line: 3, character: 19 } }, },
      { message: 'SC2154: foo is referenced but not assigned.', severity: 2, code: 2154, source: 'shellcheck', range: { start: { line: 5, character: 6 }, end: { line: 5, character: 10 } }, },
    ]
    const result = await linter.lint(FIXTURE_DOCUMENT.SHELLCHECK_SOURCE, [])
    expect(result).toEqual(expected)
  })

  it('should follow sources with incorrect cwd if correct path is passed as a workspace path', async () => {
    const linter = new Linter({
      executablePath: 'shellcheck',
      cwd: path.resolve(path.join(FIXTURE_FOLDER, '../')),
    })
    const result = await linter.lint(FIXTURE_DOCUMENT.SHELLCHECK_SOURCE, [
      { uri: `file://${path.resolve(FIXTURE_FOLDER)}`, name: 'fixtures' },
    ])
    expect(result).toEqual([])
  })
})

describe('shellcheck', () => {
  it('asserts one valid shellcheck JSON comment', async () => {
    // prettier-ignore
    const shellcheckJSON = {
      comments: [
        { file: 'testing/fixtures/comment-doc-on-hover.sh', line: 43, endLine: 43, column: 1, endColumn: 7, level: 'warning', code: 2034, message: 'bork bork', fix: null, },
      ],
    }
    assertShellcheckResult(shellcheckJSON)
  })

  it('asserts two valid shellcheck JSON comment', async () => {
    // prettier-ignore
    const shellcheckJSON = {
      comments: [
        { file: 'testing/fixtures/comment-doc-on-hover.sh', line: 43, endLine: 43, column: 1, endColumn: 7, level: 'warning', code: 2034, message: 'bork bork', fix: null, },
        { file: 'testing/fixtures/comment-doc-on-hover.sh', line: 45, endLine: 45, column: 2, endColumn: 8, level: 'warning', code: 2035, message: 'bork bork', fix: null, },
      ],
    }
    assertShellcheckResult(shellcheckJSON)
  })

  it('fails shellcheck JSON with null comments', async () => {
    const shellcheckJSON = { comments: null }
    expect(() => assertShellcheckResult(shellcheckJSON)).toThrow()
  })

  it('fails shellcheck JSON with string commment', async () => {
    const shellcheckJSON = { comments: ['foo'] }
    expect(() => assertShellcheckResult(shellcheckJSON)).toThrow()
  })

  it('fails shellcheck JSON with invalid commment', async () => {
    const make = (tweaks = {}) => ({
      comments: [
        {
          file: 'testing/fixtures/comment-doc-on-hover.sh',
          line: 43,
          endLine: 43,
          column: 1,
          endColumn: 7,
          level: 'warning',
          code: 2034,
          message: 'bork bork',
          fix: null,
          ...tweaks,
        },
      ],
    })
    assertShellcheckResult(make()) // Defaults should work

    expect(() => assertShellcheckResult(make({ file: 9 }))).toThrow()
    expect(() => assertShellcheckResult(make({ line: '9' }))).toThrow()
    expect(() => assertShellcheckResult(make({ endLine: '9' }))).toThrow()
    expect(() => assertShellcheckResult(make({ column: '9' }))).toThrow()
    expect(() => assertShellcheckResult(make({ endColumn: '9' }))).toThrow()
    expect(() => assertShellcheckResult(make({ level: 9 }))).toThrow()
    expect(() => assertShellcheckResult(make({ code: '9' }))).toThrow()
    expect(() => assertShellcheckResult(make({ message: 9 }))).toThrow()
  })
})
