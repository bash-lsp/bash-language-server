import { MarkupContent } from 'vscode-languageserver'

import { SNIPPETS } from '../snippets'

describe('snippets', () => {
  it('should have unique labels', () => {
    const labels = SNIPPETS.map((snippet) => snippet.label)
    const uniqueLabels = new Set(labels)
    expect(labels.length).toBe(uniqueLabels.size)
  })

  SNIPPETS.forEach(({ label, documentation }) => {
    it(`contains the label in the documentation for "${label}"`, () => {
      const stringDocumentation = (documentation as MarkupContent)?.value
      expect(stringDocumentation).toBeDefined()
      if (stringDocumentation) {
        expect(stringDocumentation).toContain(label)
        const secondLine = stringDocumentation.split('\n')[1]
        try {
          expect(
            secondLine.startsWith(label) || secondLine.startsWith(`[${label}]`),
          ).toBe(true)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Did not start with label: ${label}`, secondLine)
          throw error
        }
      }
    })
  })
})
