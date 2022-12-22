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

  it('returns no shell dialect for unsupported shell "#!/usr/bin/zsh"', () => {
    expect(analyzeShebang('#!/usr/bin/zsh')).toEqual({
      shellDialect: null,
      shebang: '/usr/bin/zsh',
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
  ])('returns a bash dialect for %p', (command, expectedDialect) => {
    expect(analyzeShebang(command).shellDialect).toBe(expectedDialect)
    expect(analyzeShebang(`${command} `).shellDialect).toBe(expectedDialect)
  })
})
