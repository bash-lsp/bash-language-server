import { parseShellCheckDirective } from '../directive'

describe('parseShellCheckDirective', () => {
  it('parses a disable directive', () => {
    expect(parseShellCheckDirective('# shellcheck disable=SC1000')).toEqual([
      {
        type: 'disable',
        rules: ['SC1000'],
      },
    ])
  })

  it('parses a disable directive with multiple args', () => {
    expect(parseShellCheckDirective('# shellcheck disable=SC1000,SC1001')).toEqual([
      {
        type: 'disable',
        rules: ['SC1000', 'SC1001'],
      },
    ])

    expect(
      parseShellCheckDirective(
        '# shellcheck disable=SC1000,SC2000-SC2002,SC1001 # this is a comment',
      ),
    ).toEqual([
      {
        type: 'disable',
        rules: ['SC1000', 'SC2000', 'SC2001', 'SC2002', 'SC1001'],
      },
    ])

    expect(parseShellCheckDirective('# shellcheck disable=SC1000,SC1001')).toEqual([
      {
        type: 'disable',
        rules: ['SC1000', 'SC1001'],
      },
    ])

    expect(parseShellCheckDirective('# shellcheck disable=SC1000,SC1001')).toEqual([
      {
        type: 'disable',
        rules: ['SC1000', 'SC1001'],
      },
    ])
  })

  // SC1000-SC9999
  it('parses a disable directive with a range', () => {
    expect(parseShellCheckDirective('# shellcheck disable=SC1000-SC1005')).toEqual([
      {
        type: 'disable',
        rules: ['SC1000', 'SC1001', 'SC1002', 'SC1003', 'SC1004', 'SC1005'],
      },
    ])
  })

  it('parses a disable directive with all', () => {
    expect(parseShellCheckDirective('# shellcheck disable=all')).toEqual([
      {
        type: 'disable',
        rules: ['all'],
      },
    ])
  })

  it('parses an enable directive', () => {
    expect(
      parseShellCheckDirective('# shellcheck enable=require-variable-braces'),
    ).toEqual([
      {
        type: 'enable',
        rules: ['require-variable-braces'],
      },
    ])
  })

  it('parses source directive', () => {
    expect(parseShellCheckDirective('# shellcheck source=foo.sh')).toEqual([
      {
        type: 'source',
        path: 'foo.sh',
      },
    ])

    expect(parseShellCheckDirective('# shellcheck source=/dev/null # a comment')).toEqual(
      [
        {
          type: 'source',
          path: '/dev/null',
        },
      ],
    )
  })

  it('parses source-path directive', () => {
    expect(parseShellCheckDirective('# shellcheck source-path=src/examples')).toEqual([
      {
        type: 'source-path',
        path: 'src/examples',
      },
    ])

    expect(parseShellCheckDirective('# shellcheck source-path=SCRIPTDIR')).toEqual([
      {
        type: 'source-path',
        path: 'SCRIPTDIR',
      },
    ])
  })

  it('supports multiple directives on the same line', () => {
    expect(
      parseShellCheckDirective(
        `# shellcheck cats=dogs disable=SC1234,SC2345 enable="foo" shell=bash`,
      ),
    ).toEqual([
      {
        type: 'disable',
        rules: ['SC1234', 'SC2345'],
      },
      {
        type: 'enable',
        rules: ['"foo"'],
      },
      {
        type: 'shell',
        shell: 'bash',
      },
    ])
  })

  it('parses a line with no directive', () => {
    expect(parseShellCheckDirective('# foo bar')).toEqual([])
  })

  it('does not throw on invalid directives', () => {
    expect(parseShellCheckDirective('# shellcheck')).toEqual([])
    expect(parseShellCheckDirective('# shellcheck disable = ')).toEqual([])
    expect(parseShellCheckDirective('# shellcheck disable=SC2-SC1')).toEqual([
      { type: 'disable', rules: [] },
    ])
    expect(parseShellCheckDirective('# shellcheck disable=SC0-SC-1')).toEqual([
      { type: 'disable', rules: ['SC0-SC-1'] },
    ])
  })
})
