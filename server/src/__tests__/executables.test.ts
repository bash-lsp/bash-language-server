import * as path from 'path'

import Executables from '../executables'

let executables: Executables

beforeAll(async () => {
  executables = await Executables.fromPath(
    path.resolve(__dirname, '..', '..', '..', 'testing', 'executables'),
  )
})

describe('list', () => {
  it('finds executables on the PATH', async () => {
    const result = executables.list().find((x) => x === 'iam-executable')
    expect(result).toBeTruthy()
  })

  it.skip('only considers files that have the executable bit set', async () => {
    const result = executables.list().find((x) => x === 'iam-not-executable')
    expect(result).toBeFalsy()
  })

  it('only considers executable directly on the PATH', async () => {
    const result = executables.list().find((x) => x === 'iam-executable-in-sub-folder')
    expect(result).toBeFalsy()
  })
})

describe('isExecutableOnPATH', () => {
  it('looks at the PATH it has been initialized with', async () => {
    const result = executables.isExecutableOnPATH('ls')
    expect(result).toEqual(false)
  })
})
