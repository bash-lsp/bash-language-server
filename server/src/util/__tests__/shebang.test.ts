import { FIXTURE_DOCUMENT } from '../../../../testing/fixtures'
import { analyzeShebang } from '../shebang'

describe('analyzeShebang', () => {
  it('returns null for an empty file', () => {
    expect(analyzeShebang('')).toEqual({ shellDialect: null, shebang: null })
  })

  it('returns no shell dialect for python files', () => {
    expect(analyzeShebang(`#!/usr/bin/env python2.7\n# set -x`)).toEqual({
      shellDialect: null,
      shebang: '/usr/bin/env python2.7',
    })
  })

  it('returns no shell dialect for unsupported shell "#!/usr/bin/fish"', () => {
    expect(analyzeShebang('#!/usr/bin/fish')).toEqual({
      shellDialect: null,
      shebang: '/usr/bin/fish',
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
    expect(analyzeShebang(command).shellDialect).toBe(expectedDialect)
    expect(analyzeShebang(`${command} `).shellDialect).toBe(expectedDialect)
  })

  it('returns shell dialect from shell directive', () => {
    expect(analyzeShebang('# shellcheck shell=dash')).toEqual({
      shellDialect: 'dash',
      shebang: null,
    })
  })

  it('returns shell dialect when multiple directives are passed', () => {
    expect(
      analyzeShebang(
        '# shellcheck enable=require-variable-braces shell=dash disable=SC1000',
      ),
    ).toEqual({
      shellDialect: 'dash',
      shebang: null,
    })
  })

  it('shell directive overrides file extension and shebang', () => {
    expect(
      analyzeShebang(FIXTURE_DOCUMENT.SHELLCHECK_SHELL_DIRECTIVE.getText()),
    ).toHaveProperty('shellDialect', 'sh')
  })
})
