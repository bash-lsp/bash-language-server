import { ShellCheckResultSchema } from '../types'

describe('shellcheck', () => {
  it('asserts one valid shellcheck JSON comment', async () => {
    // prettier-ignore
    const shellcheckJSON = {
      comments: [
        { file: 'testing/fixtures/comment-doc-on-hover.sh', line: 43, endLine: 43, column: 1, endColumn: 7, level: 'warning', code: 2034, message: 'bork bork', fix: null, },
      ],
    }
    ShellCheckResultSchema.parse(shellcheckJSON)
  })

  it('asserts two valid shellcheck JSON comment', async () => {
    // prettier-ignore
    const shellcheckJSON = {
      comments: [
        { file: 'testing/fixtures/comment-doc-on-hover.sh', line: 43, endLine: 43, column: 1, endColumn: 7, level: 'warning', code: 2034, message: 'bork bork', fix: null, },
        { file: 'testing/fixtures/comment-doc-on-hover.sh', line: 45, endLine: 45, column: 2, endColumn: 8, level: 'warning', code: 2035, message: 'bork bork', fix: null, },
      ],
    }
    ShellCheckResultSchema.parse(shellcheckJSON)
  })

  it('fails shellcheck JSON with null comments', async () => {
    const shellcheckJSON = { comments: null }
    expect(() => ShellCheckResultSchema.parse(shellcheckJSON)).toThrow()
  })

  it('fails shellcheck JSON with string commment', async () => {
    const shellcheckJSON = { comments: ['foo'] }
    expect(() => ShellCheckResultSchema.parse(shellcheckJSON)).toThrow()
  })

  it('fails shellcheck JSON with invalid comment', async () => {
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
    ShellCheckResultSchema.parse(make()) // Defaults should work

    expect(() => ShellCheckResultSchema.parse(make({ file: 9 }))).toThrow()
    expect(() => ShellCheckResultSchema.parse(make({ line: '9' }))).toThrow()
    expect(() => ShellCheckResultSchema.parse(make({ endLine: '9' }))).toThrow()
    expect(() => ShellCheckResultSchema.parse(make({ column: '9' }))).toThrow()
    expect(() => ShellCheckResultSchema.parse(make({ endColumn: '9' }))).toThrow()
    expect(() => ShellCheckResultSchema.parse(make({ level: 9 }))).toThrow()
    expect(() => ShellCheckResultSchema.parse(make({ code: '9' }))).toThrow()
    expect(() => ShellCheckResultSchema.parse(make({ message: 9 }))).toThrow()
  })
})
