import { flattenArray } from '../flatten'

describe('flattenArray', () => {
  it('works on array with one element', () => {
    expect(flattenArray([[1, 2, 3]])).toEqual([1, 2, 3])
  })

  it('works on array with multiple elements', () => {
    expect(flattenArray([[1], [2, 3], [4]])).toEqual([1, 2, 3, 4])
  })
})
