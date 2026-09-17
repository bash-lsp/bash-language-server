import { getMockConnection } from '../../../testing/mocks'
import Analyzer from '../analyser'
import { initializeParser } from '../parser'
import BashServer from '../server'
import * as fsUtil from '../util/fs'
import * as disk from '../util/read-file'
import WorkspaceIndex from '../workspace-index'

it.each(['shutdown', 'configuration change'])(
  'cancels pending discovery on %s',
  async (event) => {
    let signal: AbortSignal | undefined
    const scan = jest.spyOn(fsUtil, 'getFilePaths').mockImplementation((options) => {
      ;({ signal } = options)
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve([]), { once: true })
      })
    })
    const backgroundAnalysis = jest.spyOn(WorkspaceIndex.prototype, 'configure')
    try {
      const connection = getMockConnection()
      const server = await BashServer.initialize(connection, {
        rootUri: 'file:///tmp/background-lifecycle',
        processId: 42,
        capabilities: {},
      })
      server.register(connection)
      expect(await connection.onInitialized.mock.calls[0][0]({})).toBeUndefined()
      const backgroundAnalysisCompleted = backgroundAnalysis.mock.results[0].value
      expect(signal?.aborted).toBe(false)
      if (event === 'shutdown') {
        await connection.onShutdown.mock.calls[0][0]({} as any)
      } else {
        connection.onDidChangeConfiguration.mock.calls[0][0]({
          settings: { bashIde: { backgroundAnalysisMaxFiles: 0 } },
        })
      }
      expect(signal?.aborted).toBe(true)
      await expect(backgroundAnalysisCompleted).resolves.toEqual({ filesParsed: 0 })
    } finally {
      scan.mockRestore()
      backgroundAnalysis.mockRestore()
    }
  },
)

it('does not analyze a file whose read finishes after cancellation', async () => {
  const parser = await initializeParser()
  const analyzer = new Analyzer({ parser, workspaceFolder: '/tmp' })
  const index = new WorkspaceIndex(analyzer, '/tmp')
  const scan = jest.spyOn(fsUtil, 'getFilePaths').mockResolvedValue(['/tmp/stale.sh'])
  let completeRead: (text: string) => void = () => undefined
  let readStarted!: () => void
  const reading = new Promise<void>((resolve) => {
    readStarted = resolve
  })
  const read = jest.spyOn(disk, 'readFileForAnalysis').mockImplementation(
    () =>
      new Promise((resolve) => {
        completeRead = resolve as typeof completeRead
        readStarted()
      }),
  )
  const analyze = jest.spyOn(analyzer, 'analyze')
  try {
    const pending = index.configure({
      globPattern: '**/*.sh',
      backgroundAnalysisMaxFiles: 500,
    })
    await reading
    expect(read).toHaveBeenCalled()
    index.dispose()
    completeRead('stale=1')
    await expect(pending).resolves.toEqual({ filesParsed: 0 })
    expect(analyze).not.toHaveBeenCalled()
  } finally {
    read.mockRestore()
    scan.mockRestore()
    analyze.mockRestore()
    parser.delete()
  }
})
