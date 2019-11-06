import { hasBashShebang } from '../shebang'

describe('hasBashShebang', () => {
  it('returns false for empty file', () => {
    expect(hasBashShebang('')).toBe(false)
  })

  it('returns false for python files', () => {
    expect(hasBashShebang(`#!/usr/bin/env python2.7\n# set -x`)).toBe(false)
  })

  it('returns true for "#!/bin/sh -"', () => {
    expect(hasBashShebang('#!/bin/sh -')).toBe(true)
    expect(hasBashShebang('#!/bin/sh - ')).toBe(true)
  })

  it('returns true for "#!/usr/bin/env bash"', () => {
    expect(hasBashShebang('#!/usr/bin/env bash')).toBe(true)
    expect(hasBashShebang('#!/usr/bin/env bash ')).toBe(true)
  })

  it('returns true for "#!/bin/sh"', () => {
    expect(hasBashShebang('#!/bin/sh')).toBe(true)
    expect(hasBashShebang('#!/bin/sh ')).toBe(true)
  })

  it('returns true for "#!/bin/bash"', () => {
    expect(hasBashShebang('#!/bin/bash')).toBe(true)
    expect(hasBashShebang('#!/bin/bash ')).toBe(true)
  })
})
