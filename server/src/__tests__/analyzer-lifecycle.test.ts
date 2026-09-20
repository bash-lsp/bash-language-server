import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Parser, Tree } from 'web-tree-sitter'

import Analyzer from '../analyser'
import { initializeParser } from '../parser'
import * as sourcing from '../util/sourcing'

describe('analyzer tree ownership', () => {
  const uri = 'file:///tmp/tree-lifecycle.sh'
  let parser: Parser
  let analyzer: Analyzer
  let trees: Tree[]
  let deleted: MockInstance<Tree['delete']>

  beforeEach(async () => {
    parser = await initializeParser()
    analyzer = new Analyzer({ parser, workspaceFolder: null })
    trees = []
    deleted = vi.spyOn(Tree.prototype, 'delete')
    const parse = parser.parse.bind(parser)
    vi.spyOn(parser, 'parse').mockImplementation((...args) => {
      const tree = parse(...args)
      if (tree) trees.push(tree)
      return tree
    })
  })

  afterEach(() => {
    // The last cached tree still belongs to the analyzer. Replaced and failed
    // trees have already been freed by analyze().
    const freedTrees = new Set(deleted.mock.contexts)
    for (const tree of trees) {
      if (!freedTrees.has(tree)) tree.delete()
    }
    parser.delete()
    vi.restoreAllMocks()
  })

  function analyze(text: string, version = 1) {
    return analyzer.analyze({
      uri,
      document: TextDocument.create(uri, 'shellscript', version, text),
    })
  }

  it('frees replaced trees while keeping the latest symbols usable', () => {
    for (let version = 1; version <= 50; version++) {
      analyze(`value_${version}=ok`, version)
      expect(analyzer.getDeclarationsForUri({ uri }).map(({ name }) => name)).toEqual([
        `value_${version}`,
      ])
    }
    expect(deleted).toHaveBeenCalledTimes(49)
    expect(deleted.mock.contexts).toEqual(trees.slice(0, -1))
  })

  it('frees an uncached tree if analysis fails and preserves the previous document', () => {
    analyze('original=ok')
    vi.spyOn(sourcing, 'getSourceCommands').mockImplementationOnce(() => {
      throw new Error('source analysis failed')
    })

    expect(() => analyze('replacement=ok', 2)).toThrow('source analysis failed')
    expect(deleted).toHaveBeenCalledTimes(1)
    expect(deleted.mock.contexts).toEqual([trees[1]])
    expect(analyzer.getDocument(uri)?.getText()).toBe('original=ok')
    expect(analyzer.getDeclarationsForUri({ uri }).map(({ name }) => name)).toEqual([
      'original',
    ])

    analyze('recovered=ok', 3)
    expect(deleted).toHaveBeenCalledTimes(2)
    expect(analyzer.getDeclarationsForUri({ uri }).map(({ name }) => name)).toEqual([
      'recovered',
    ])
  })

  it('preserves the cached tree when the parser returns no replacement', () => {
    analyze('original=ok')
    vi.spyOn(parser, 'parse').mockReturnValueOnce(null)

    expect(() => analyze('replacement=ok', 2)).toThrow('no syntax tree returned')
    expect(deleted).not.toHaveBeenCalled()
    expect(analyzer.getDeclarationsForUri({ uri }).map(({ name }) => name)).toEqual([
      'original',
    ])
  })
})
