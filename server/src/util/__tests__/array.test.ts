import { flattenArray, uniqueBasedOnHash } from '../array'

describe('flattenArray', () => {
  it('works on array with one element', () => {
    expect(flattenArray([[1, 2, 3]])).toEqual([1, 2, 3])
  })

  it('works on array with multiple elements', () => {
    expect(flattenArray([[1], [2, 3], [4]])).toEqual([1, 2, 3, 4])
  })
})

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
