import * as path from 'path'
import { Executables } from '../executables'

const executables = Executables.fromPath(
  path.resolve(__dirname, '..', '..', '..', 'testing', 'executables'),
)

describe('list', () => {
  it('It finds executables on the PATH', () => {
    expect.assertions(1)
    const result = executables.then(ex => ex.list().find(x => x === 'iam-executable'))
    return expect(result).resolves.toBeTruthy()
  })

  it.skip('It only considers files that have the executable bit set', () => {
    expect.assertions(1)
    const result = executables.then(ex => ex.list().find(x => x === 'iam-not-executable'))
    return expect(result).resolves.toBeFalsy()
  })

  it('It only considers executable directly on the PATH', () => {
    expect.assertions(1)
    const result = executables.then(ex =>
      ex.list().find(x => x === 'iam-executable-in-sub-folder'),
    )
    return expect(result).resolves.toBeFalsy()
  })
})

describe('documentation', () => {
  it('It uses `man` so it disregards the PATH it has been initialized with', () => {
    expect.assertions(1)
    const result = executables.then(x => x.documentation('ls'))
    return expect(result).resolves.toBeTruthy()
  })
})

describe('isExecutableOnPATH', () => {
  it('it looks at the PATH it has been initialized with', () => {
    expect.assertions(1)
    const result = executables.then(x => x.isExecutableOnPATH('ls'))
    return expect(result).resolves.toEqual(false)
  })
})
