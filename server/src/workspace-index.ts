import { pathToFileURL } from 'node:url'

import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from './analyser'
import { getFilePaths } from './util/fs'
import { logger } from './util/logger'
import { readFileForAnalysis } from './util/read-file'
import { analyzeFile } from './util/shebang'

type Selection = { globPattern: string; backgroundAnalysisMaxFiles: number }

/** Owns workspace selection and serializes disk refreshes independently of parsing. */
export default class WorkspaceIndex {
  private selected = new Set<string>()
  private changes = new Map<string, LSP.FileChangeType>()
  private selection: Selection = { globPattern: '**/*.sh', backgroundAnalysisMaxFiles: 0 }
  private generation = 0
  private needsScan = false
  private running?: Promise<{ filesParsed: number }>

  public constructor(
    private readonly analyzer: Analyzer,
    private readonly rootPath: string | null,
    private readonly isOpen: (uri: string) => boolean = () => false,
    private readonly onSourcesChanged: (uris: string[]) => Promise<void> = async () => {},
  ) {}

  public getFileUris(): string[] {
    return [...this.selected].filter((uri) => !!this.analyzer.getDocument(uri))
  }

  public close(uri: string): Promise<{ filesParsed: number }> {
    // Excluded files no longer belong to the index once their editor closes.
    // A sourced file can still be reloaded lazily by the Analyzer when needed.
    if (!this.selected.has(uri)) this.analyzer.removeDocument(uri)
    return this.update([{ uri, type: LSP.FileChangeType.Changed }])
  }

  public configure(selection: Selection): Promise<{ filesParsed: number }> {
    this.selection = selection
    this.generation++
    this.needsScan = true
    return this.schedule()
  }

  public update(changes: LSP.FileEvent[]): Promise<{ filesParsed: number }> {
    for (const { uri, type } of changes) {
      if (!uri.startsWith('file:')) continue
      this.changes.set(uri, type)
      // A bounded rescan handles capacity and split create/delete rename events.
      if (type !== LSP.FileChangeType.Changed) this.needsScan = true
    }
    return this.schedule()
  }

  private schedule(): Promise<{ filesParsed: number }> {
    if (!this.running) {
      this.running = this.drain().finally(() => {
        this.running = undefined
      })
    }
    return this.running
  }

  private async drain(): Promise<{ filesParsed: number }> {
    // Coalesce filesystem notification bursts, including separate rename events.
    await new Promise((resolve) => setTimeout(resolve, 25))
    let filesParsed = 0
    while (this.needsScan || this.changes.size) {
      const scan = this.needsScan
      const { changes, generation } = this
      this.needsScan = false
      this.changes = new Map()
      try {
        filesParsed = await this.reconcile(scan, changes, generation)
      } catch (error) {
        logger.warn(`WorkspaceIndex: refresh failed: ${error}`)
      }
      if (generation !== this.generation) {
        // A rescan retries selected files, but cached sources may be outside
        // the glob. Carry their cancelled events forward as well.
        for (const [uri, type] of changes) {
          if (!this.changes.has(uri)) this.changes.set(uri, type)
        }
      }
    }
    return { filesParsed }
  }

  private async reconcile(
    scan: boolean,
    changes: Map<string, LSP.FileChangeType>,
    generation: number,
  ): Promise<number> {
    const refresh = new Set(changes.keys())
    if (scan) {
      logger.info(`BackgroundAnalysis: resolving glob "${this.selection.globPattern}"`)
      const paths =
        this.rootPath && this.selection.backgroundAnalysisMaxFiles > 0
          ? await getFilePaths({
              rootPath: this.rootPath,
              globPattern: this.selection.globPattern,
              maxItems: this.selection.backgroundAnalysisMaxFiles,
            })
          : []
      if (generation !== this.generation) return 0
      const selected = new Set(paths.map((file) => pathToFileURL(file).href))
      for (const uri of this.selected) {
        if (!selected.has(uri) && !this.isOpen(uri)) this.analyzer.removeDocument(uri)
      }
      for (const uri of selected) {
        // Retry any reads discarded by a concurrent configuration change.
        refresh.add(uri)
      }
      this.selected = selected
    }
    const filesParsed = this.selected.size
    for (const uri of refresh) {
      if (generation !== this.generation) return 0
      if (this.changes.has(uri)) continue
      if (changes.get(uri) === LSP.FileChangeType.Deleted) {
        this.selected.delete(uri)
        if (!this.isOpen(uri)) this.analyzer.removeDocument(uri)
        continue
      }
      const previous = this.analyzer.getDocument(uri)
      if (this.isOpen(uri) || (!previous && !this.selected.has(uri))) continue
      try {
        const text = await readFileForAnalysis(new URL(uri))
        if (
          generation !== this.generation ||
          this.changes.has(uri) ||
          this.isOpen(uri) ||
          this.analyzer.getDocument(uri) !== previous
        )
          continue
        if (analyzeFile(uri, text).dialect) {
          this.analyzer.analyze({
            uri,
            document: TextDocument.create(uri, 'shellscript', 1, text),
          })
        } else {
          this.analyzer.removeDocument(uri)
        }
      } catch (error) {
        if (
          generation !== this.generation ||
          this.changes.has(uri) ||
          this.isOpen(uri) ||
          this.analyzer.getDocument(uri) !== previous
        )
          continue
        this.analyzer.removeDocument(uri)
        logger.debug(`WorkspaceIndex: could not read ${uri}: ${error}`)
      }
    }
    if (generation === this.generation) {
      await this.onSourcesChanged(this.analyzer.refreshSourceCommands())
    }
    return filesParsed
  }
}
