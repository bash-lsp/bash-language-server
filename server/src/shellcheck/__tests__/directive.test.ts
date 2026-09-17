import { addDisabledRule, parseShellCheckDirective } from '../directive'

describe('addDisabledRule', () => {
  it.each([
    ['# shellcheck disable=SC3000,SC1000', '# shellcheck disable=SC1000,SC2154,SC3000'],
    [
      '\t#shellcheck\tdisable=2000,3000 # reason',
      '\t#shellcheck\tdisable=2000,SC2154,3000 # reason',
    ],
    [
      '# shellcheck disable=SC1000-SC1002 source=/dev/null',
      '# shellcheck disable=SC1000-SC1002,SC2154 source=/dev/null',
    ],
    [
      '# shellcheck source="path # disable=SC1000" disable=SC2000',
      '# shellcheck source="path # disable=SC1000" disable=SC2000,SC2154',
    ],
    [
      "# shellcheck source='path disable=SC1000' disable=SC2000",
      "# shellcheck source='path disable=SC1000' disable=SC2000,SC2154",
    ],
  ])('preserves existing text in %s', (line, expected) => {
    expect(addDisabledRule(line, 'SC2154')).toBe(expected)
  })

  it.each(['SC2154', '2154', 'SC2000-SC3000', '2000-3000', '2000-SC3000', 'all'])(
    'does not duplicate a rule covered by %s',
    (rules) => {
      const line = `# shellcheck disable=${rules}`
      expect(addDisabledRule(line, 'SC2154')).toBe(line)
    },
  )

  it.each([
    ['SC1000-SC9999', 'SC1000', 'SC1000-SC9999'],
    ['SC1000-SC9999', 'SC9999', 'SC1000-SC9999'],
    ['SC2154-SC2154', 'SC2154', 'SC2154-SC2154'],
    ['SC2000-SC3000', 'SC1999', 'SC1999,SC2000-SC3000'],
    ['SC2000-SC3000', 'SC3001', 'SC2000-SC3000,SC3001'],
    ['SC3000-SC2000', 'SC2154', 'SC2154,SC3000-SC2000'],
    ['0999-SC1001', 'SC1000', '0999-SC1001'],
    ['0000-0002', 'SC1', '0000-0002'],
    ['0000-0002', 'SC0001', '0000-0002,SC0001'],
    ['0001', 'SC0001', '0001'],
    ['0001', 'SC1', '0001,SC1'],
  ])(
    'preserves range and code spelling behavior for %s and %s',
    (rules, code, expected) => {
      expect(addDisabledRule(`# shellcheck disable=${rules}`, code)).toBe(
        `# shellcheck disable=${expected}`,
      )
    },
  )

  it.each([
    '# ordinary comment',
    '# shellcheck source=/dev/null # disable=SC1000',
    '# shellcheck source="disable=SC1000"',
    '# shellcheck disable="SC1000"',
    '# shellcheck disable=SC1000 \\',
    '# shellcheck disable=1000-999999999999',
    '# shellcheck disable=invalid',
  ])('leaves unsupported directives intact: %s', (line) => {
    expect(addDisabledRule(line, 'SC2154')).toBeNull()
  })
})

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
