import * as Builtins from '../builtins'

describe('documentation', () => {
  it('returns an error string an unknown builtin', async () => {
    const result = await Builtins.documentation('foobar')
    expect(result).toEqual('No help page for foobar')
  })

  it('returns documentation string an known builtin', async () => {
    const result = await Builtins.documentation('exit')
    const firstLine = result.split('\n')[0]
    expect(firstLine).toEqual('exit: exit [n]')
  })
})
