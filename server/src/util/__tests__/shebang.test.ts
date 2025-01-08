import { FIXTURE_DOCUMENT } from '../../../../testing/fixtures'
import { analyzeFile } from '../shebang'

describe('analyzeShebang', () => {
  it('returns default for an empty file', () => {
    expect(analyzeFile('', '')).toEqual({
      shebang: null,
      directive: null,
      isDetected: false,
      dialect: 'bash',
    })
  })

  it('returns no shell dialect for python files', () => {
    expect(analyzeFile('', `#!/usr/bin/env python2.7\n# set -x`)).toEqual({
      shebang: 'python2.7',
      directive: null,
      isDetected: true,
      dialect: null,
    })
  })

  it('returns no shell dialect for unsupported shell "#!/usr/bin/fish"', () => {
    expect(analyzeFile('', '#!/usr/bin/fish')).toEqual({
      shebang: 'fish',
      directive: null,
      isDetected: true,
      dialect: null,
    })
  })

  test.each([
    ['#!/bin/sh -', 'sh'],
    ['#!/bin/sh', 'sh'],
    ['#!/bin/env sh', 'sh'],
    ['#!/usr/bin/env bash', 'bash'],
    ['#!/bin/env bash', 'bash'],
    ['#!/bin/bash', 'bash'],
    ['#!/bin/bash -u', 'bash'],
    ['#! /bin/bash', 'bash'],
    ['#! /bin/dash', 'dash'],
    ['#!/usr/bin/bash', 'bash'],
    ['#!/usr/bin/zsh', 'zsh'],
  ])('returns a bash dialect for %p', (command, expectedDialect) => {
    expect(analyzeFile('', command).dialect).toBe(expectedDialect)
    expect(analyzeFile('', `${command} `).dialect).toBe(expectedDialect)
  })

  it('returns shell dialect from shell directive', () => {
    expect(analyzeFile('', '# shellcheck shell=dash')).toEqual({
      shebang: null,
      directive: 'dash',
      isDetected: true,
      dialect: 'dash',
    })
  })

  it('returns shell dialect when multiple directives are passed', () => {
    expect(
      analyzeFile(
        '',
        '# shellcheck enable=require-variable-braces shell=dash disable=SC1000',
      ),
    ).toEqual({
      shebang: null,
      directive: 'dash',
      isDetected: true,
      dialect: 'dash',
    })
  })

  it('shell directive overrides file extension and shebang', () => {
    expect(
      analyzeFile(
        FIXTURE_DOCUMENT.SHELLCHECK_SHELL_DIRECTIVE.uri,
        FIXTURE_DOCUMENT.SHELLCHECK_SHELL_DIRECTIVE.getText(),
      ),
    ).toMatchObject({
      isDetected: true,
      dialect: 'sh',
    })
  })
})
