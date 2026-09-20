import { pathToFileURL } from 'node:url'

import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import Analyzer from './analyser'
import { getDefaultConfiguration } from './config'
import { getFilePaths } from './util/fs'
import { logger } from './util/logger'
import { readFileForAnalysis } from './util/read-file'
import { analyzeFile } from './util/shebang'

const BACKGROUND_ANALYSIS_TIMEOUT_MS = 10000

type Selection = {
  globPattern: string
  backgroundAnalysisMaxFiles: number
  backgroundAnalysisIgnore?: string[]
}

/** Owns workspace selection and serializes disk refreshes independently of parsing. */
export default class WorkspaceIndex {
  private selected = new Set<string>()
  private changes = new Map<string, LSP.FileChangeType>()
  private selection: Selection = { globPattern: '**/*.sh', backgroundAnalysisMaxFiles: 0 }
  private generation = 0
  private needsScan = false
  private refreshAll = false
  private disposed = false
  private controller?: AbortController
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
    if (this.selected.has(uri)) this.analyzer.closeDocument(uri)
    else this.analyzer.removeDocument(uri)
    this.analyzer.evictBackgroundDocuments(new Set(this.selected))
    return this.update([{ uri, type: LSP.FileChangeType.Changed }])
  }

  public configure(selection: Selection): Promise<{ filesParsed: number }> {
    if (this.disposed) return Promise.resolve({ filesParsed: 0 })
    this.selection = selection
    this.generation++
    this.controller?.abort()
    this.needsScan = true
    this.refreshAll = true
    return this.schedule()
  }

  public dispose(): void {
    this.disposed = true
    this.generation++
    this.controller?.abort()
    this.needsScan = false
    this.changes.clear()
  }

  public update(changes: LSP.FileEvent[]): Promise<{ filesParsed: number }> {
    if (this.disposed) return Promise.resolve({ filesParsed: 0 })
    for (const { uri, type } of changes) {
      if (!uri.startsWith('file:')) continue
      if (
        type === LSP.FileChangeType.Changed &&
        !this.selected.has(uri) &&
        !this.analyzer.getDocument(uri)
      )
        continue
      this.changes.set(uri, type)
      // A bounded rescan handles capacity and split create/delete rename events.
      if (type !== LSP.FileChangeType.Changed) this.needsScan = true
    }
    if (!this.changes.size) return this.running ?? Promise.resolve({ filesParsed: 0 })
    return this.schedule(25)
  }

  private schedule(delay = 0): Promise<{ filesParsed: number }> {
    if (!this.running) {
      this.running = this.drain(delay).finally(() => {
        this.running = undefined
      })
    }
    return this.running
  }

  private async drain(delay: number): Promise<{ filesParsed: number }> {
    let filesParsed = 0
    while (!this.disposed && (this.needsScan || this.changes.size)) {
      // Coalesce filesystem notification bursts, including separate rename events.
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
      if (this.disposed) break
      const { needsScan: scan, refreshAll, changes, generation } = this
      this.needsScan = false
      this.refreshAll = false
      this.changes = new Map()
      try {
        filesParsed = await this.reconcile(scan, refreshAll, changes)
      } catch (error) {
        logger.warn(`WorkspaceIndex: refresh failed: ${error}`)
      }
      if (generation !== this.generation && !this.disposed) {
        // Cached sources may be outside the glob. Carry their cancelled events
        // forward as well, without overwriting more recent notifications.
        for (const [uri, type] of changes) {
          if (!this.changes.has(uri)) this.changes.set(uri, type)
        }
      }
      delay = 25
    }
    return { filesParsed }
  }

  private async reconcile(
    scan: boolean,
    refreshAll: boolean,
    changes: Map<string, LSP.FileChangeType>,
  ): Promise<number> {
    const controller = new AbortController()
    this.controller = controller
    const { signal } = controller
    const deadline = Date.now() + BACKGROUND_ANALYSIS_TIMEOUT_MS
    const expire = () => {
      if (signal.aborted) return
      logger.warn(
        `BackgroundAnalysis: stopped after ${BACKGROUND_ANALYSIS_TIMEOUT_MS}ms; workspace symbols may be incomplete. Exclude large folders with backgroundAnalysisIgnore or narrow globPattern.`,
      )
      controller.abort()
    }
    const stopped = () => {
      // Synchronous parsing can delay the timer; check between parses as well.
      if (Date.now() >= deadline) expire()
      return signal.aborted
    }
    const timer = setTimeout(expire, BACKGROUND_ANALYSIS_TIMEOUT_MS)
    let filesParsed = 0
    try {
      const refresh = new Set(changes.keys())
      const opened = [...this.selected].filter(this.isOpen)
      if (scan) {
        logger.info(`BackgroundAnalysis: resolving glob "${this.selection.globPattern}"`)
        const defaults = getDefaultConfiguration()
        const paths =
          this.rootPath && this.selection.backgroundAnalysisMaxFiles > 0
            ? await cancellable(
                getFilePaths({
                  rootPath: this.rootPath,
                  globPattern: this.selection.globPattern,
                  maxItems: this.selection.backgroundAnalysisMaxFiles,
                  ignore:
                    this.selection.backgroundAnalysisIgnore ??
                    defaults.backgroundAnalysisIgnore,
                  skipHiddenEntries: this.selection.globPattern === defaults.globPattern,
                  signal,
                  timeoutMs: BACKGROUND_ANALYSIS_TIMEOUT_MS,
                  onLimit: (reason) => {
                    if (reason === 'time') expire()
                    else
                      logger.warn(
                        'BackgroundAnalysis: stopped discovery at the directories limit; workspace symbols may be incomplete. Exclude large folders with backgroundAnalysisIgnore or narrow globPattern.',
                      )
                  },
                }),
                signal,
              )
            : []
        if (stopped() || !paths) return filesParsed
        const selected = new Set(paths.map((file) => pathToFileURL(file).href))
        for (const uri of selected) {
          // Structural notifications need only load newly selected files. A
          // configuration change also retries interrupted or outdated analysis.
          if (
            !this.analyzer.getDocument(uri) ||
            (refreshAll && this.analyzer.isBackgroundDocument(uri))
          )
            refresh.add(uri)
        }
        const retained = new Set([...selected, ...opened])
        this.analyzer.evictBackgroundDocuments(retained)
        this.selected = selected
      }
      for (const uri of refresh) {
        if (stopped()) return filesParsed
        if (this.changes.has(uri)) continue
        if (changes.get(uri) === LSP.FileChangeType.Deleted) {
          this.selected.delete(uri)
          if (!this.isOpen(uri)) this.analyzer.removeDocument(uri)
          continue
        }
        const previous = this.analyzer.getDocument(uri)
        if (this.isOpen(uri) || (!previous && !this.selected.has(uri))) continue
        const stale = () =>
          stopped() ||
          this.changes.has(uri) ||
          this.isOpen(uri) ||
          this.analyzer.getDocument(uri) !== previous
        let text: string | undefined
        try {
          text = await cancellable(readFileForAnalysis(new URL(uri), signal), signal)
        } catch (error) {
          if (stale()) continue
          this.analyzer.removeDocument(uri)
          logger.debug(`WorkspaceIndex: could not read ${uri}: ${error}`)
          continue
        }
        if (stale() || text === undefined) continue
        if (!analyzeFile(uri, text).dialect) {
          this.analyzer.removeDocument(uri)
          continue
        }
        try {
          this.analyzer.analyze({
            uri,
            document: TextDocument.create(uri, 'shellscript', 1, text),
            background: !previous || this.analyzer.isBackgroundDocument(uri),
          })
          filesParsed++
        } catch (error) {
          // Analysis owns tree replacement and preserves the previous document
          // on parse failure. Only failed disk reads invalidate the cache.
          logger.warn(`WorkspaceIndex: could not analyze ${uri}: ${error}`)
        }
      }
      if (!stopped()) {
        const affected = this.analyzer.refreshSourceCommands()
        const retained = new Set([...this.selected, ...opened])
        this.analyzer.evictBackgroundDocuments(retained)
        await cancellable(this.onSourcesChanged(affected), signal)
      }
      return filesParsed
    } finally {
      clearTimeout(timer)
      if (this.controller === controller) this.controller = undefined
    }
  }
}

/** Settle cancellation even if an underlying OS operation cannot be interrupted. */
async function cancellable<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T | undefined> {
  let cancel = () => {}
  const canceled = new Promise<undefined>((resolve) => {
    cancel = () => resolve(undefined)
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
  })
  try {
    return await Promise.race([work, canceled])
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}
