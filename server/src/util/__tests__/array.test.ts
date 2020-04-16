import { uniqueBasedOnHash } from '../array'

describe('uniqueBasedOnHash', () => {
  it('returns a list of unique elements', () => {
    type Item = { x: string; y: number }

    const items: Item[] = [
      { x: '1', y: 1 },
      { x: '1', y: 2 },
      { x: '2', y: 3 },
    ]

    const hashFunction = ({ x }: Item) => x
    const result = uniqueBasedOnHash(items, hashFunction)
    expect(result).toEqual([
      { x: '1', y: 1 },
      { x: '2', y: 3 },
    ])
  })
})
