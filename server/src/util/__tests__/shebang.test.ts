import { hasBashShebang } from '../shebang'

describe('hasBashShebang', () => {
  it('returns false for empty file', () => {
    expect(hasBashShebang('')).toBe(false)
  })

  it('returns false for python files', () => {
    expect(hasBashShebang(`#!/usr/bin/env python2.7\n# set -x`)).toBe(false)
  })

  it('returns false for "#!/usr/bin/pwsh"', () => {
    expect(hasBashShebang('#!/usr/bin/pwsh')).toBe(false)
  })

  test.each([
    ['#!/bin/sh -'],
    ['#!/usr/bin/env bash'],
    ['#!/bin/sh'],
    ['#!/bin/bash'],
    ['#!/bin/bash -u'],
    ['#! /bin/bash'],
    ['#!/usr/bin/bash'],
  ])('returns true for %p', (command) => {
    expect(hasBashShebang(command)).toBe(true)
    expect(hasBashShebang(`${command} `)).toBe(true)
  })
})
