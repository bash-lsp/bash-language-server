import { initializeParser } from '../parser'

describe('initializeParser', () => {
  it('loads the bundled grammar without changing global fetch', async () => {
    const originalFetch = global.fetch
    expect(originalFetch).toEqual(expect.any(Function))

    const parser = await initializeParser()
    try {
      expect(global.fetch).toBe(originalFetch)
      expect(parser.language?.name).toBe('bash')
    } finally {
      parser.delete()
    }
  })

  it('parses arithmetic commands and preserves UTF-16 positions after emoji', async () => {
    const parser = await initializeParser()
    const tree = parser.parse('echo "🦀" "$HOME"\n((count = 1, count += 2))\n')
    try {
      expect(tree).not.toBeNull()
      expect(tree!.rootNode.hasError).toBe(false)
      expect(tree!.rootNode.descendantsOfType('compound_statement')).toHaveLength(1)

      const home = tree!.rootNode.descendantsOfType('variable_name')[0]
      expect(home.text).toBe('HOME')
      expect(home.startIndex).toBe(12)
      expect(home.endIndex).toBe(16)
      expect(home.startPosition).toEqual({ row: 0, column: 12 })
      expect(home.endPosition).toEqual({ row: 0, column: 16 })
    } finally {
      tree?.delete()
      parser.delete()
    }
  })
})
