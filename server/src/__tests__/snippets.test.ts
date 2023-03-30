import { SNIPPETS } from '../snippets'

describe('snippets', () => {
  it('should have unique labels', () => {
    const labels = SNIPPETS.map((snippet) => snippet.label)
    const uniqueLabels = new Set(labels)
    expect(labels.length).toBe(uniqueLabels.size)
  })
})
