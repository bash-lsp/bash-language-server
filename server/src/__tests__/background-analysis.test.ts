import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

import { TextDocument } from 'vscode-languageserver-textdocument'
import { Parser, Tree } from 'web-tree-sitter'

import Analyzer from '../analyser'
import { getDefaultConfiguration } from '../config'
import { initializeParser } from '../parser'
import * as fsUtil from '../util/fs'
import { Logger } from '../util/logger'

describe('background analysis ownership and budgets', () => {
  let root: string
  let parser: Parser
  let analyzer: Analyzer
  let trees: Tree[]
  let deleted: jest.SpiedFunction<Tree['delete']>

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'bash-background-'))
    parser = await initializeParser()
    analyzer = new Analyzer({ parser, workspaceFolder: root })
    trees = []
    deleted = jest.spyOn(Tree.prototype, 'delete')
    const parse = parser.parse.bind(parser)
    jest.spyOn(parser, 'parse').mockImplementation((...args) => {
      const tree = parse(...args)
      if (tree) trees.push(tree)
      return tree
    })
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    analyzer.cancelBackgroundAnalysis()
    const freed = new Set(deleted.mock.contexts)
    for (const tree of trees) if (!freed.has(tree)) tree.delete()
    parser.delete()
    jest.restoreAllMocks()
    jest.useRealTimers()
    fs.rmSync(root, { recursive: true, force: true })
  })

  function write(name: string, text: string) {
    const file = path.join(root, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
    return pathToFileURL(file).href
  }

  function scan(
    options: Partial<Parameters<Analyzer['initiateBackgroundAnalysis']>[0]> = {},
  ) {
    return analyzer.initiateBackgroundAnalysis({
      globPattern: getDefaultConfiguration().globPattern,
      backgroundAnalysisMaxFiles: 500,
      ...options,
    })
  }

  function open(uri: string, text: string) {
    analyzer.analyze({ uri, document: TextDocument.create(uri, 'shell', 2, text) })
  }

  it('evicts newly ignored background symbols and frees their trees', async () => {
    const uri = write('generated/script.sh', 'generated_value=1\necho "$generated_value"')
    await expect(scan()).resolves.toEqual({ filesParsed: 1 })
    const oldTree = trees[0]
    expect(analyzer.findDeclarationsWithFuzzySearch('generated_value')).toHaveLength(1)
    expect(analyzer.findReferences('generated_value')).not.toHaveLength(0)

    await expect(
      scan({ backgroundAnalysisIgnore: ['**/generated/**'] }),
    ).resolves.toEqual({ filesParsed: 0 })
    expect(analyzer.getDocument(uri)).toBeUndefined()
    expect(analyzer.findDeclarationsWithFuzzySearch('generated_value')).toEqual([])
    expect(analyzer.findReferences('generated_value')).toEqual([])
    expect(deleted.mock.contexts).toEqual([oldTree])

    await expect(scan()).resolves.toEqual({ filesParsed: 1 })
    expect(analyzer.findDeclarationsWithFuzzySearch('generated_value')).toHaveLength(1)
  })

  it('retains an opened document and does not replace its unsaved contents on rescan', async () => {
    const uri = write('generated/open.sh', 'disk_value=1')
    const staleUri = write('generated/stale.sh', 'stale_value=1')
    await scan()
    open(uri, 'unsaved_value=2')
    await scan()
    expect(analyzer.getDocument(uri)?.getText()).toBe('unsaved_value=2')

    await scan({ backgroundAnalysisIgnore: ['**/generated/**'] })
    expect(analyzer.getDocument(staleUri)).toBeUndefined()
    expect(analyzer.getDocument(uri)?.getText()).toBe('unsaved_value=2')
  })

  it.each(['before', 'after'])(
    'retains sourced documents first analyzed %s background discovery',
    async (when) => {
      const library = write('generated/lib.sh', 'library_value=1')
      const parent = pathToFileURL(path.join(root, 'opened.sh')).href
      if (when === 'after') await scan()
      open(parent, 'source ./generated/lib.sh')
      if (when === 'before') {
        // This analyzes the sourced file on demand before a scan sees it.
        analyzer.getAllVariables({ uri: parent, position: { line: 1, character: 0 } })
        await scan()
      }

      await scan({ backgroundAnalysisIgnore: ['**/generated/**'] })
      expect(analyzer.getDocument(library)?.getText()).toBe('library_value=1')
      expect(analyzer.findDeclarationsWithFuzzySearch('library_value')).toHaveLength(1)
    },
  )

  it('removes background-only entries when background analysis is disabled', async () => {
    const uri = write('script.sh', 'background_value=1')
    await scan()
    await scan({ backgroundAnalysisMaxFiles: 0 })
    expect(analyzer.getDocument(uri)).toBeUndefined()
    expect(deleted).toHaveBeenCalledTimes(1)
  })

  it('evicts ignored dependencies after a reread removes their source relationship', async () => {
    const old = write('old.sh', 'old_value=1')
    write('lib.sh', 'source ./old.sh\nlibrary_value=1')
    await scan()
    const oldTree = trees.find((tree) => tree.rootNode.text === 'old_value=1')
    const parent = pathToFileURL(path.join(root, 'opened.sh')).href
    open(parent, 'source ./lib.sh')

    write('lib.sh', 'library_value=2')
    await scan({ backgroundAnalysisIgnore: ['**/old.sh'] })
    expect(analyzer.findAllSourcedUris({ uri: parent })).not.toContain(old)
    expect(analyzer.getDocument(old)).toBeUndefined()
    expect(analyzer.findDeclarationsWithFuzzySearch('old_value')).toEqual([])
    expect(deleted.mock.contexts).toContain(oldTree)
  })

  it('does not evict newer results when superseded discovery finishes late', async () => {
    const uri = write('current.sh', 'current_value=1')
    const discover = fsUtil.getFilePaths
    let completeDiscovery: (files: string[]) => void = () => undefined
    jest
      .spyOn(fsUtil, 'getFilePaths')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            completeDiscovery = resolve
          }),
      )
      .mockImplementation(discover)

    const previous = scan()
    await scan()
    completeDiscovery([])
    await expect(previous).resolves.toEqual({ filesParsed: 0 })
    expect(analyzer.getDocument(uri)?.getText()).toBe('current_value=1')
  })

  it('prunes hidden directories for the default glob and preserves explicit hidden globs', async () => {
    const hidden = write('.cache/nested/hidden.sh', 'hidden_value=1')
    write('visible.sh', 'visible_value=1')
    const readdir = jest.spyOn(fs, 'readdir')
    await expect(scan()).resolves.toEqual({ filesParsed: 1 })
    expect(readdir.mock.calls.map(([directory]) => directory)).not.toContain(
      path.join(root, '.cache'),
    )
    expect(analyzer.getDocument(hidden)).toBeUndefined()

    await expect(scan({ globPattern: '{.cache,visible}/**/*.sh' })).resolves.toEqual({
      filesParsed: 1,
    })
    expect(analyzer.getDocument(hidden)?.getText()).toBe('hidden_value=1')
  })

  it('does not overwrite a document opened while its background read is pending', async () => {
    const uri = write('script.sh', 'disk_value=1')
    jest.spyOn(fsUtil, 'getFilePaths').mockResolvedValue([path.join(root, 'script.sh')])
    let completeRead: (text: string) => void = () => undefined
    const read = jest.spyOn(fs.promises, 'readFile').mockImplementation(
      () =>
        new Promise((resolve) => {
          completeRead = resolve as typeof completeRead
        }),
    )
    const pending = scan()
    await Promise.resolve()
    expect(read).toHaveBeenCalled()
    open(uri, 'unsaved_value=2')
    completeRead('disk_value=1')
    await expect(pending).resolves.toEqual({ filesParsed: 0 })
    expect(analyzer.getDocument(uri)?.getText()).toBe('unsaved_value=2')
  })

  it('uses the remaining total budget for reads and settles without waiting for late I/O', async () => {
    jest.useFakeTimers()
    let signal: AbortSignal | undefined
    jest.spyOn(fsUtil, 'getFilePaths').mockImplementation((options) => {
      ;({ signal } = options)
      return new Promise((resolve) =>
        setTimeout(() => resolve([path.join(root, 'late.sh')]), 8000),
      )
    })
    let completeRead: (text: string) => void = () => undefined
    const read = jest.spyOn(fs.promises, 'readFile').mockImplementation(
      () =>
        new Promise((resolve) => {
          completeRead = resolve as typeof completeRead
        }),
    )
    const warning = jest.spyOn(Logger.prototype, 'warn')
    const pending = scan()
    await jest.advanceTimersByTimeAsync(8000)
    expect(read).toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1999)
    expect(signal?.aborted).toBe(false)
    await jest.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toEqual({ filesParsed: 0 })
    expect(signal?.aborted).toBe(true)
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('stopped after 10000ms'))
    expect(jest.getTimerCount()).toBe(0)

    completeRead('late_value=1')
    await Promise.resolve()
    expect(trees).toHaveLength(0)
  })

  it('checks elapsed time between parses even if synchronous work delays the timer', async () => {
    jest.useFakeTimers()
    jest
      .spyOn(fsUtil, 'getFilePaths')
      .mockResolvedValue([path.join(root, 'first.sh'), path.join(root, 'second.sh')])
    const read = jest.spyOn(fs.promises, 'readFile').mockResolvedValue('value=1')
    const analyze = analyzer.analyze.bind(analyzer)
    jest.spyOn(analyzer, 'analyze').mockImplementation((options) => {
      const result = analyze(options)
      jest.setSystemTime(Date.now() + 10001)
      return result
    })
    const warning = jest.spyOn(Logger.prototype, 'warn')
    await expect(scan()).resolves.toEqual({ filesParsed: 1 })
    expect(read).toHaveBeenCalledTimes(1)
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('stopped after 10000ms'))
    expect(jest.getTimerCount()).toBe(0)
  })
})
