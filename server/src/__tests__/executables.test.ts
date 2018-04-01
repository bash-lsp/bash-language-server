import * as path from 'path'
import { Executables } from '../executables'

const executablesPromise = Executables.fromPath(
  path.resolve(__dirname, '..', '..', '..', 'testing', 'executables'),
)

describe('list', () => {
  it('finds executables on the PATH', async () => {
    expect.assertions(1)
    const executables = await executablesPromise
    const result = executables.list().find(x => x === 'iam-executable')
    return expect(result).toBeTruthy()
  })

  it.skip('only considers files that have the executable bit set', async () => {
    expect.assertions(1)
    const executables = await executablesPromise
    const result = executables.list().find(x => x === 'iam-not-executable')
    return expect(result).toBeFalsy()
  })

  it('only considers executable directly on the PATH', async () => {
    expect.assertions(1)
    const executables = await executablesPromise
    const result = executables.list().find(x => x === 'iam-executable-in-sub-folder')
    return expect(result).toBeFalsy()
  })
})

describe('documentation', () => {
  it('uses `man` so it disregards the PATH it has been initialized with', async () => {
    expect.assertions(1)
    const executables = await executablesPromise
    const result = await executables.documentation('ls')
    return expect(result).toBeTruthy()
  })
})

describe('isExecutableOnPATH', () => {
  it('looks at the PATH it has been initialized with', async () => {
    expect.assertions(1)
    const executables = await executablesPromise
    const result = executables.isExecutableOnPATH('ls')
    return expect(result).toEqual(false)
  })
})
