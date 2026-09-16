import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import {
  FIXTURE_DOCUMENT,
  FIXTURE_FOLDER,
  FIXTURE_URI,
  REPO_ROOT_FOLDER,
  updateSnapshotUris,
} from '../../../testing/fixtures'
import { getMockConnection } from '../../../testing/mocks'
import LspServer, { getCommandOptions } from '../server'
import { Linter } from '../shellcheck'
import { CompletionItemDataType } from '../types'
import { Logger } from '../util/logger'
import WorkspaceIndex from '../workspace-index'

// Skip only the ShellCheck debounce, preserving resource-limit timers.
const realSetTimeout = global.setTimeout
jest.spyOn(global, 'setTimeout').mockImplementation((fn: any, ms?: number) => {
  if (ms === 500) {
    fn()
    return 0 as any
  }
  return realSetTimeout(fn, ms)
})

jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {
  // noop
})

async function initializeServer({
  capabilities,
  configurationObject,
  rootPath,
  initializationOptions,
}: {
  capabilities?: LSP.ClientCapabilities
  configurationObject?: unknown
  rootPath?: string
  initializationOptions?: unknown
} = {}) {
  const diagnostics: Array<LSP.PublishDiagnosticsParams | undefined> = []

  const connection = getMockConnection()

  const server = await LspServer.initialize(connection, {
    rootPath: rootPath || pathToFileURL(FIXTURE_FOLDER).href,
    rootUri: null,
    processId: 42,
    capabilities: capabilities || {},
    workspaceFolders: null,
    initializationOptions,
  })

  if (configurationObject) {
    const getConfiguration = connection.workspace.getConfiguration as any
    getConfiguration.mockResolvedValue(configurationObject)
  }

  server.register(connection)
  const onInitialized = connection.onInitialized.mock.calls[0][0]
  const backgroundAnalysis = jest.spyOn(server as any, 'startBackgroundAnalysis')
  try {
    expect(await onInitialized({})).toBeUndefined()
    await backgroundAnalysis.mock.results[0].value
  } finally {
    backgroundAnalysis.mockRestore()
  }

  return {
    connection,
    console,
    diagnostics,
    server,
  }
}

describe('server', () => {
  it('initializes and responds to capabilities', async () => {
    const { server } = await initializeServer()
    expect(server.capabilities()).toMatchInlineSnapshot(`
      {
        "codeActionProvider": {
          "codeActionKinds": [
            "quickfix",
          ],
          "resolveProvider": false,
          "workDoneProgress": false,
        },
        "completionProvider": {
          "resolveProvider": true,
          "triggerCharacters": [
            "$",
            "{",
            "-",
            "/",
          ],
        },
        "definitionProvider": true,
        "documentFormattingProvider": true,
        "documentHighlightProvider": true,
        "documentSymbolProvider": true,
        "hoverProvider": true,
        "referencesProvider": true,
        "renameProvider": {
          "prepareProvider": true,
        },
        "textDocumentSync": 1,
        "workspaceSymbolProvider": true,
      }
    `)
  })

  it('register LSP connection', async () => {
    const { connection } = await initializeServer()

    expect(connection.onCodeAction).toHaveBeenCalledTimes(1)
    expect(connection.onCompletion).toHaveBeenCalledTimes(1)
    expect(connection.onCompletionResolve).toHaveBeenCalledTimes(1)
    expect(connection.onDefinition).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentHighlight).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onHover).toHaveBeenCalledTimes(1)
    expect(connection.onReferences).toHaveBeenCalledTimes(1)
    expect(connection.onWorkspaceSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onPrepareRename).toHaveBeenCalledTimes(1)
    expect(connection.onRenameRequest).toHaveBeenCalledTimes(1)
    expect(connection.onDidChangeWatchedFiles).toHaveBeenCalledTimes(1)
  })

  it('registers filesystem notifications and forwards them to the index', async () => {
    const { connection } = await initializeServer({
      capabilities: {
        workspace: { didChangeWatchedFiles: { dynamicRegistration: true } },
      },
    })
    expect(connection.client.register).toHaveBeenCalledWith(
      LSP.DidChangeWatchedFilesNotification.type,
      { watchers: [{ globPattern: '**/*' }] },
    )
    const update = jest
      .spyOn(WorkspaceIndex.prototype, 'update')
      .mockResolvedValue({ filesParsed: 0 })
    try {
      const changes: LSP.FileEvent[] = [
        { uri: FIXTURE_URI.COMMENT_DOC, type: LSP.FileChangeType.Changed },
      ]
      await connection.onDidChangeWatchedFiles.mock.calls[0][0]({ changes })
      expect(update).toHaveBeenCalledWith(changes)
    } finally {
      update.mockRestore()
    }
  })

  it('allows for defining workspace configuration', async () => {
    const { connection } = await initializeServer({
      capabilities: {
        workspace: {
          configuration: true,
        },
      },
      configurationObject: {
        explainshellEndpoint: 'foo',
      },
    })

    expect(connection.workspace.getConfiguration).toHaveBeenCalled()
    expect(Logger.prototype.log).not.toHaveBeenCalledWith(expect.any(Number), [
      expect.stringContaining('updateConfiguration: failed'),
    ])
  })

  it('uses initialization options to disable background analysis', async () => {
    const backgroundAnalysis = jest.spyOn(WorkspaceIndex.prototype, 'configure')
    try {
      await initializeServer({ initializationOptions: { backgroundAnalysisMaxFiles: 0 } })

      expect(backgroundAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ backgroundAnalysisMaxFiles: 0 }),
      )
      await expect(backgroundAnalysis.mock.results[0].value).resolves.toEqual({
        filesParsed: 0,
      })
    } finally {
      backgroundAnalysis.mockRestore()
    }
  })

  it('prefers workspace configuration over initialization options', async () => {
    const backgroundAnalysis = jest.spyOn(WorkspaceIndex.prototype, 'configure')
    try {
      await initializeServer({
        capabilities: { workspace: { configuration: true } },
        initializationOptions: { backgroundAnalysisMaxFiles: 0 },
        configurationObject: { backgroundAnalysisMaxFiles: 1 },
      })

      expect(backgroundAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ backgroundAnalysisMaxFiles: 1 }),
      )
    } finally {
      backgroundAnalysis.mockRestore()
    }
  })

  it.each([
    { initializationOptions: [] },
    { initializationOptions: 'invalid' },
    { initializationOptions: { backgroundAnalysisMaxFiles: -1 } },
    { initializationOptions: { shfmt: [] } },
    { initializationOptions: { shfmt: { languageDialect: 'invalid' } } },
    { initializationOptions: { shellcheckArguments: [1] } },
    { initializationOptions: { shfmt: { additionalArguments: [null] } } },
    { initializationOptions: { shellcheckArguments: 42 } },
    { initializationOptions: { shfmt: { additionalArguments: null } } },
  ])(
    'ignores invalid initialization options: $initializationOptions',
    async ({ initializationOptions }) => {
      await initializeServer({ initializationOptions })

      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.any(Number), [
        expect.stringContaining('Failed to parse initialization options'),
      ])
    },
  )

  it('retains initialization options when workspace configuration is unavailable', async () => {
    const backgroundAnalysis = jest.spyOn(WorkspaceIndex.prototype, 'configure')
    try {
      await initializeServer({
        capabilities: { workspace: { configuration: true } },
        initializationOptions: { backgroundAnalysisMaxFiles: 0 },
      })

      expect(backgroundAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ backgroundAnalysisMaxFiles: 0 }),
      )
    } finally {
      backgroundAnalysis.mockRestore()
    }
  })

  it('preserves environment settings omitted from initialization options', async () => {
    const environment = process.env
    process.env = {
      ...environment,
      SHELLCHECK_PATH: '',
      GLOB_PATTERN: '**/*.custom-bash',
      SHFMT_PATH: 'custom-shfmt',
    }
    const lint = jest.spyOn(Linter.prototype, 'lint')
    const backgroundAnalysis = jest.spyOn(WorkspaceIndex.prototype, 'configure')
    try {
      const { server } = await initializeServer({
        initializationOptions: {
          backgroundAnalysisMaxFiles: 0,
          shfmt: { languageDialect: 'bash' },
        },
      })
      await server.analyzeAndLintDocument(FIXTURE_DOCUMENT.COMMENT_DOC)

      expect(lint).not.toHaveBeenCalled()
      expect(backgroundAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundAnalysisMaxFiles: 0,
          globPattern: '**/*.custom-bash',
        }),
      )
      expect(server).toMatchObject({
        config: { shfmt: { path: 'custom-shfmt', languageDialect: 'bash' } },
      })
    } finally {
      process.env = environment
      lint.mockRestore()
      backgroundAnalysis.mockRestore()
    }
  })

  it.each(['debug', 'error'])(
    'preserves an environment-only log level of %s with unrelated initialization options',
    async (logLevel) => {
      const environment = process.env
      process.env = { PATH: environment.PATH, BASH_IDE_LOG_LEVEL: logLevel }
      try {
        const { server } = await initializeServer({
          initializationOptions: { backgroundAnalysisMaxFiles: 0 },
        })

        expect(server).toMatchObject({ config: { logLevel } })
        expect(Logger.prototype.log).not.toHaveBeenCalledWith(expect.any(Number), [
          expect.stringContaining(
            'Environment variable configuration is being deprecated',
          ),
        ])
      } finally {
        process.env = environment
      }
    },
  )

  it('ignores invalid workspace configuration', async () => {
    const { connection } = await initializeServer({
      capabilities: {
        workspace: {
          configuration: true,
        },
      },
      configurationObject: {
        explainshellEndpoint: 42,
      },
    })

    expect(connection.workspace.getConfiguration).toHaveBeenCalled()
    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.any(Number), [
      expect.stringContaining('updateConfiguration: failed'),
    ])
  })

  it('responds to onDidChangeConfiguration', async () => {
    const { connection } = await initializeServer({
      capabilities: {
        workspace: {
          configuration: true,
        },
      },
    })

    const onDidChangeConfiguration = connection.onDidChangeConfiguration.mock.calls[0][0]

    onDidChangeConfiguration({ settings: { bashIde: { explainshellEndpoint: 42 } } })

    expect(connection.workspace.getConfiguration).toHaveBeenCalled()
    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.any(Number), [
      expect.stringContaining('updateConfiguration: failed'),
    ])
  })

  describe('onCodeAction', () => {
    it('responds to onCodeAction', async () => {
      const { connection, server } = await initializeServer()
      const document = FIXTURE_DOCUMENT.COMMENT_DOC

      await server.analyzeAndLintDocument(document)

      expect(connection.sendDiagnostics).toHaveBeenCalledTimes(1)
      const { diagnostics } = connection.sendDiagnostics.mock.calls[0][0]
      const fixableDiagnostic = diagnostics.filter(({ code }) => code === 'SC2086')[0]

      expect(fixableDiagnostic).toMatchInlineSnapshot(`
        {
          "code": "SC2086",
          "codeDescription": {
            "href": "https://www.shellcheck.net/wiki/SC2086",
          },
          "data": {
            "id": "shellcheck|2086|55:5-55:13",
          },
          "message": "Double quote to prevent globbing and word splitting.",
          "range": {
            "end": {
              "character": 13,
              "line": 55,
            },
            "start": {
              "character": 5,
              "line": 55,
            },
          },
          "severity": 3,
          "source": "shellcheck",
          "tags": undefined,
        }
      `)

      const onCodeAction = connection.onCodeAction.mock.calls[0][0]

      const result = await onCodeAction(
        {
          textDocument: {
            uri: FIXTURE_URI.COMMENT_DOC,
          },
          range: fixableDiagnostic.range,
          context: {
            diagnostics: [fixableDiagnostic],
          },
        },
        {} as any,
        {} as any,
      )

      expect(updateSnapshotUris(result)).toMatchSnapshot()
    })

    it('offers suppression without an automatic fix and ignores unknown diagnostics', async () => {
      const { connection, server } = await initializeServer()
      const document = TextDocument.create(
        FIXTURE_URI.COMMENT_DOC,
        'shellscript',
        1,
        '#!/bin/bash\n: before\necho "$foo"',
      )
      await server.analyzeAndLintDocument(document)
      const { diagnostics } = connection.sendDiagnostics.mock.calls[0][0]
      const diagnostic = diagnostics.find(({ code }) => code === 'SC2154')!
      const onCodeAction = connection.onCodeAction.mock.calls[0][0]
      const result = (await onCodeAction(
        {
          textDocument: { uri: document.uri },
          range: diagnostic.range,
          context: {
            diagnostics: [
              diagnostic,
              { ...diagnostic, data: undefined },
              { ...diagnostic, data: { id: 'unknown' } },
            ],
          },
        },
        {} as any,
        {} as any,
      )) as LSP.CodeAction[]
      expect(result.map(({ title }) => title)).toEqual([
        'Disable ShellCheck rule SC2154 for this command',
        'Disable ShellCheck rule SC2154 for the entire file',
      ])
      for (const action of result) {
        expect(action.diagnostics).toEqual([diagnostic])
        const edited = TextDocument.applyEdits(
          document,
          action.edit!.changes![document.uri],
        )
        expect(edited).toContain('# shellcheck disable=SC2154\n')
      }
    })

    it('deduplicates suppressions while preserving distinct fixes and command scopes', async () => {
      const { connection, server } = await initializeServer()
      const document = TextDocument.create(
        FIXTURE_URI.COMMENT_DOC,
        'shellscript',
        1,
        '#!/bin/bash\n: before\necho $foo $bar\necho $baz',
      )
      await server.analyzeAndLintDocument(document)
      const diagnostics = connection.sendDiagnostics.mock.calls[0][0].diagnostics.filter(
        ({ code }) => code === 'SC2086',
      )
      expect(diagnostics).toHaveLength(3)
      const onCodeAction = connection.onCodeAction.mock.calls[0][0]
      const result = (await onCodeAction(
        {
          textDocument: { uri: document.uri },
          range: LSP.Range.create(0, 0, 4, 0),
          context: { diagnostics: [...diagnostics, diagnostics[0]] },
        },
        {} as any,
        {} as any,
      )) as LSP.CodeAction[]
      expect(result.filter(({ title }) => title === 'Apply fix for SC2086')).toHaveLength(
        3,
      )
      expect(
        result.filter(({ title }) => title.endsWith('for this command')),
      ).toHaveLength(2)
      expect(
        result.filter(({ title }) => title.endsWith('for the entire file')),
      ).toHaveLength(1)
    })

    it('invalidates previous edits while a changed document is being linted', async () => {
      const { connection, server } = await initializeServer()
      const document = TextDocument.create(
        FIXTURE_URI.COMMENT_DOC,
        'shellscript',
        1,
        '#!/bin/bash\n: before\necho $foo',
      )
      await server.analyzeAndLintDocument(document)
      const { diagnostics } = connection.sendDiagnostics.mock.calls[0][0]
      let finishLint!: (result: null) => void
      const lint = jest.spyOn(Linter.prototype, 'lint').mockImplementation(
        () =>
          new Promise((resolve) => {
            finishLint = resolve
          }),
      )
      try {
        const pending = server.analyzeAndLintDocument(
          TextDocument.create(
            document.uri,
            'shellscript',
            2,
            '#!/bin/bash\necho updated',
          ),
        )
        const result = await connection.onCodeAction.mock.calls[0][0](
          {
            textDocument: { uri: document.uri },
            range: LSP.Range.create(0, 0, 3, 0),
            context: { diagnostics },
          },
          {} as any,
          {} as any,
        )
        expect(result).toEqual([])
        finishLint(null)
        await pending
      } finally {
        lint.mockRestore()
      }
    })
  })

  describe('onCompletion', () => {
    it('completes source paths using the catalog updated by file events', async () => {
      const directory = mkdtempSync(join(tmpdir(), 'bash-lsp-completion-'))
      const main = join(directory, 'main.sh')
      const library = join(directory, 'library.sh')
      try {
        writeFileSync(main, 'source ')
        const { connection } = await initializeServer({
          rootPath: pathToFileURL(directory).href,
        })
        const complete = () =>
          connection.onCompletion.mock.calls[0][0](
            {
              textDocument: { uri: pathToFileURL(main).href },
              position: { line: 0, character: 7 },
            },
            {} as any,
            {} as any,
          )
        expect(await complete()).toEqual([])
        writeFileSync(library, 'greet() { :; }')
        await connection.onDidChangeWatchedFiles.mock.calls[0][0]({
          changes: [
            { uri: pathToFileURL(library).href, type: LSP.FileChangeType.Created },
          ],
        })
        expect(await complete()).toMatchObject([
          {
            label: './library.sh',
            kind: LSP.CompletionItemKind.File,
            textEdit: { newText: './library.sh' },
          },
        ])
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    })

    describe.each([false, undefined, true])('snippetSupport=%s', (snippetSupport) => {
      it.each([
        { name: 'all completions', line: 26, character: 0 },
        { name: 'filtered completions', line: 14, character: 2 },
      ])('honors the client capability for $name', async ({ line, character }) => {
        const { connection } = await initializeServer({
          capabilities:
            snippetSupport === undefined
              ? {}
              : {
                  textDocument: {
                    completion: { completionItem: { snippetSupport } },
                  },
                },
        })

        const onCompletion = connection.onCompletion.mock.calls[0][0]
        const result = (await onCompletion(
          {
            textDocument: { uri: FIXTURE_URI.INSTALL },
            position: { line, character },
          },
          {} as any,
          {} as any,
        )) as LSP.CompletionItem[]

        expect(
          result.some((item) => item.insertTextFormat === LSP.InsertTextFormat.Snippet),
        ).toBe(snippetSupport === true)
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              label: 'if',
              kind: LSP.CompletionItemKind.Keyword,
            }),
          ]),
        )
      })
    })

    it('responds to onCompletion with filtered list when word is found', async () => {
      const { connection } = await initializeServer()

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const result = (await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.INSTALL,
          },
          position: {
            // rm
            line: 25,
            character: 5,
          },
        },
        {} as any,
        {} as any,
      )) as LSP.CompletionItem[]

      // The number of matching executables depends on the user's PATH.
      for (const item of result) {
        expect(item.label).toMatch(/^rm/)
      }
      expect(result).toEqual(
        expect.arrayContaining([
          {
            data: {
              type: CompletionItemDataType.Executable,
            },
            kind: expect.any(Number),
            label: 'rm',
          },
        ]),
      )
    })

    it('responds to onCompletion with options list when command name is found', async () => {
      if (getCommandOptions('find', '-').length === 0) {
        // This might not work on all systems
        // eslint-disable-next-line no-console
        console.warn('Skipping onCompletion test as getCommandOptions failed')
        return
      }

      const { connection } = await initializeServer()

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const result = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.OPTIONS,
          },
          position: {
            // grep --line-
            line: 2,
            character: 12,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result).toEqual(
        expect.arrayContaining([
          {
            data: {
              type: CompletionItemDataType.Symbol,
            },
            kind: expect.any(Number),
            label: '--line-buffered',
            textEdit: {
              newText: 'buffered',
              range: {
                start: {
                  character: 12,
                  line: 2,
                },
                end: {
                  character: 12,
                  line: 2,
                },
              },
            },
          },
        ]),
      )
    })

    it('responds to onCompletion with entire list when no word is found', async () => {
      const { connection } = await initializeServer()

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const result = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.INSTALL,
          },
          position: {
            // empty space
            line: 26,
            character: 0,
          },
        },
        {} as any,
        {} as any,
      )

      // Entire list
      expect(result && 'length' in result && result.length).toBeGreaterThanOrEqual(50)
    })

    it('responds to onCompletion with empty list when the following characters is not an empty string or whitespace', async () => {
      const { connection } = await initializeServer()

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const result = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.INSTALL,
          },
          position: {
            // {
            line: 271,
            character: 21,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result).toEqual([])
    })

    it('responds to onCompletion with empty list when word is a comment', async () => {
      const { connection } = await initializeServer()

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const result = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.INSTALL,
          },
          position: {
            // inside comment
            line: 2,
            character: 1,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result).toEqual([])
    })

    it('responds to onCompletion with empty list when word is {', async () => {
      const { connection } = await initializeServer()

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const result = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.ISSUE101,
          },
          position: {
            // the opening brace '{' to 'add_a_user'
            line: 4,
            character: 0,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result).toEqual([])
    })

    it('responds to onCompletion when word is found in another file', async () => {
      const { connection } = await initializeServer()

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const resultVariable = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.SOURCING,
          },
          position: {
            // $BLU (variable)
            line: 6,
            character: 7,
          },
        },
        {} as any,
        {} as any,
      )

      expect(resultVariable).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **BLUE** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "BLUE",
          },
        ]
      `)

      const resultFunction = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.SOURCING,
          },
          position: {
            // add_a_us (function)
            line: 8,
            character: 7,
          },
        },
        {} as any,
        {} as any,
      )

      expect(resultFunction).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Function: **add_a_user** - *defined in issue101.sh*

        \`\`\`txt
        Helper function to add a user
        \`\`\`",
            },
            "kind": 3,
            "label": "add_a_user",
          },
        ]
      `)
    })

    it('responds to onCompletion with local symbol when word is found in multiple files', async () => {
      const { connection } = await initializeServer()

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const result = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.SOURCING,
          },
          position: {
            // BOL (BOLD is defined in multiple places)
            line: 12,
            character: 7,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "type": 3,
            },
            "documentation": undefined,
            "kind": 6,
            "label": "BOLD",
          },
        ]
      `)
    })

    it('responds to onCompletion with all variables when starting to expand parameters', async () => {
      const { connection } = await initializeServer({ rootPath: REPO_ROOT_FOLDER })

      const onCompletion = connection.onCompletion.mock.calls[0][0]

      const result = await onCompletion(
        {
          textDocument: {
            uri: FIXTURE_URI.SOURCING,
          },
          position: {
            // $
            line: 14,
            character: 7,
          },
        },
        {} as any,
        {} as any,
      )

      // they are all variables
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "type": 3,
            },
            "documentation": undefined,
            "kind": 6,
            "label": "BOLD",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **RED** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "RED",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **GREEN** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "GREEN",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **BLUE** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "BLUE",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **RESET** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "RESET",
          },
          {
            "data": {
              "type": 3,
            },
            "documentation": {
              "kind": "markdown",
              "value": "Variable: **FILE_PATH** - *defined in extension.inc*",
            },
            "kind": 6,
            "label": "FILE_PATH",
          },
        ]
      `)
    })
  })

  describe('onCompletionResolve', () => {
    it('resolves documentation for buitins', async () => {
      const { connection } = await initializeServer({ rootPath: REPO_ROOT_FOLDER })

      const onCompletionResolve = connection.onCompletionResolve.mock.calls[0][0]

      const item = {
        data: {
          type: CompletionItemDataType.Builtin,
        },
        kind: LSP.CompletionItemKind.Function,
        label: 'echo',
      }
      const result = await onCompletionResolve(item, {} as any)

      expect(result).toEqual({
        ...item,
        documentation: {
          kind: 'markdown',
          value: expect.stringMatching(
            /Write arguments to the standard output|Output the ARGs/,
          ),
        },
      })
    })

    it('ignores unknown items', async () => {
      const { connection } = await initializeServer({ rootPath: REPO_ROOT_FOLDER })

      const onCompletionResolve = connection.onCompletionResolve.mock.calls[0][0]

      const item = {
        data: {
          type: CompletionItemDataType.Symbol,
        },
        kind: LSP.CompletionItemKind.Function,
        label: 'foobar',
      }
      const result = await onCompletionResolve(item, {} as any)

      expect(result).toEqual({
        ...item,
        documentation: undefined,
      })
    })
  })

  describe('onDefinition', () => {
    it.each(['absolute', 'relative', 'workspace'])(
      'percent-encodes definitions from a %s source path',
      async (sourceType) => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), 'bash-lsp-uri-'))
        const workspaceDirectory = join(temporaryDirectory, 'project #? %23 café')
        const documentDirectory =
          sourceType === 'workspace'
            ? join(workspaceDirectory, 'scripts')
            : workspaceDirectory
        mkdirSync(documentDirectory, { recursive: true })
        const sourceName = 'library #? %23 café.inc'
        const sourcePath = join(workspaceDirectory, sourceName)
        const sourceUri = pathToFileURL(sourcePath).href
        const documentPath = join(documentDirectory, 'main.sh')
        const sourcedPath = sourceType === 'absolute' ? sourcePath : `./${sourceName}`

        try {
          writeFileSync(sourcePath, 'greet() { echo hello; }\n')
          writeFileSync(documentPath, `source "${sourcedPath}"\ngreet\n`)
          const { connection } = await initializeServer({
            rootPath: pathToFileURL(workspaceDirectory).href,
          })
          const onDefinition = connection.onDefinition.mock.calls[0][0]

          for (const line of [0, 1]) {
            const result = await onDefinition(
              {
                textDocument: { uri: pathToFileURL(documentPath).href },
                position: { line, character: 2 },
              },
              {} as any,
              {} as any,
            )

            expect(result).toEqual([
              {
                uri: sourceUri,
                range: expect.any(Object),
              },
            ])
            const location = (result as LSP.Location[])[0]
            expect(fileURLToPath(location.uri)).toBe(sourcePath)
            expect(new URL(location.uri).hash).toBe('')
            expect(new URL(location.uri).search).toBe('')
          }
        } finally {
          rmSync(temporaryDirectory, { recursive: true, force: true })
        }
      },
    )

    it('responds to onDefinition', async () => {
      const { connection } = await initializeServer()

      const onDefinition = connection.onDefinition.mock.calls[0][0]

      const result = await onDefinition(
        {
          textDocument: {
            uri: FIXTURE_URI.SOURCING,
          },
          position: { character: 10, line: 2 },
        },
        {} as any,
        {} as any,
      )

      expect(updateSnapshotUris(result)).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 0,
                "line": 0,
              },
              "start": {
                "character": 0,
                "line": 0,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/extension.inc",
          },
        ]
      `)
    })
  })

  describe('onDocumentHighlight', () => {
    it('responds to onDocumentHighlight', async () => {
      const { connection } = await initializeServer()

      const onDocumentHighlight = connection.onDocumentHighlight.mock.calls[0][0]

      const result1 = await onDocumentHighlight(
        {
          textDocument: {
            uri: FIXTURE_URI.ISSUE206,
          },
          position: {
            // FOO
            line: 0,
            character: 10,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result1).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 12,
                "line": 0,
              },
              "start": {
                "character": 9,
                "line": 0,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 28,
                "line": 1,
              },
              "start": {
                "character": 25,
                "line": 1,
              },
            },
          },
        ]
      `)

      const result2 = await onDocumentHighlight(
        {
          textDocument: {
            uri: FIXTURE_URI.ISSUE206,
          },
          position: {
            // readonly is a declaration command so not parsed correctly by findOccurrences
            line: 0,
            character: 0,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result2).toMatchInlineSnapshot(`[]`)

      const result3 = await onDocumentHighlight(
        {
          textDocument: {
            uri: FIXTURE_URI.SCOPE,
          },
          position: {
            // X
            line: 32,
            character: 8,
          },
        },
        {} as any,
        {} as any,
      )

      expect(result3).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 1,
                "line": 2,
              },
              "start": {
                "character": 0,
                "line": 2,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 1,
                "line": 4,
              },
              "start": {
                "character": 0,
                "line": 4,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 9,
                "line": 8,
              },
              "start": {
                "character": 8,
                "line": 8,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 11,
                "line": 12,
              },
              "start": {
                "character": 10,
                "line": 12,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 13,
                "line": 15,
              },
              "start": {
                "character": 12,
                "line": 15,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 13,
                "line": 19,
              },
              "start": {
                "character": 12,
                "line": 19,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 15,
                "line": 20,
              },
              "start": {
                "character": 14,
                "line": 20,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 11,
                "line": 29,
              },
              "start": {
                "character": 10,
                "line": 29,
              },
            },
          },
          {
            "range": {
              "end": {
                "character": 9,
                "line": 32,
              },
              "start": {
                "character": 8,
                "line": 32,
              },
            },
          },
        ]
      `)
    })
  })

  describe('onDocumentSymbol', () => {
    it('responds to onDocumentSymbol', async () => {
      const { connection } = await initializeServer()

      const onDocumentSymbol = connection.onDocumentSymbol.mock.calls[0][0]

      const result = await onDocumentSymbol(
        {
          textDocument: {
            uri: FIXTURE_URI.SOURCING,
          },
        },
        {} as any,
        {} as any,
      )

      expect(updateSnapshotUris(result)).toMatchInlineSnapshot(`
        [
          {
            "kind": 13,
            "location": {
              "range": {
                "end": {
                  "character": 16,
                  "line": 10,
                },
                "start": {
                  "character": 0,
                  "line": 10,
                },
              },
              "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/sourcing.sh",
            },
            "name": "BOLD",
          },
          {
            "kind": 12,
            "location": {
              "range": {
                "end": {
                  "character": 1,
                  "line": 22,
                },
                "start": {
                  "character": 0,
                  "line": 20,
                },
              },
              "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/sourcing.sh",
            },
            "name": "loadlib",
          },
        ]
      `)
    })
  })

  describe('onHover', () => {
    async function getHoverResult(uri: string, position: LSP.Position) {
      const { connection } = await initializeServer()

      const onHover = connection.onHover.mock.calls[0][0]

      return onHover(
        {
          textDocument: {
            uri,
          },
          position,
        },
        {} as any,
        {} as any,
      )
    }
    it('responds with documentation for command', async () => {
      const result = await getHoverResult(FIXTURE_URI.INSTALL, {
        // rm
        line: 25,
        character: 5,
      })

      expect(result).toEqual({
        contents: {
          kind: 'markdown',
          value: expect.stringContaining('remove directories'),
        },
      })
    })

    it('responds with function documentation extracted from comments', async () => {
      const result = await getHoverResult(FIXTURE_URI.COMMENT_DOC, {
        line: 17,
        character: 0,
      })

      expect(result).toMatchInlineSnapshot(`
        {
          "contents": {
            "kind": "markdown",
            "value": "Function: **hello_world** - *defined on line 8*

        \`\`\`txt
        this is a comment
        describing the function
        hello_world
        this function takes two arguments
        \`\`\`",
          },
        }
      `)
    })

    it('displays correct documentation for symbols in file that override path executables', async () => {
      const result = await getHoverResult(FIXTURE_URI.OVERRIDE_SYMBOL, {
        line: 9,
        character: 1,
      })

      expect(result).toMatchInlineSnapshot(`
        {
          "contents": {
            "kind": "markdown",
            "value": "Function: **ls** - *defined on line 6*

        \`\`\`txt
        override documentation for \`ls\` symbol
        \`\`\`",
          },
        }
      `)
    })

    it('returns executable documentation if the function is not redefined', async () => {
      const result1 = await getHoverResult(FIXTURE_URI.OVERRIDE_SYMBOL, {
        line: 2,
        character: 1,
      })
      expect(result1).toEqual({
        contents: {
          kind: 'markdown',
          value: expect.stringContaining('list directory contents'),
        },
      })

      // return null same result if the cursor is on the arguments
      const result2 = await getHoverResult(FIXTURE_URI.OVERRIDE_SYMBOL, {
        line: 2,
        character: 3,
      })
      expect(result2).toEqual(null)
    })

    it('responds with documentation even if parsing fails', async () => {
      const result = await getHoverResult(FIXTURE_URI.MISSING_NODE, {
        // echo
        line: 11,
        character: 2,
      })

      expect(result).toEqual({
        contents: {
          kind: 'markdown',
          value: expect.stringContaining('echo'),
        },
      })
    })

    it.skip('returns documentation from explainshell', async () => {
      // Skipped as this requires a running explainshell server (and the code is hard to mock)
      // docker container run --name explainshell --restart always -p 127.0.0.1:6000:5000 -d spaceinvaderone/explainshell

      const { connection } = await initializeServer({
        capabilities: {
          workspace: {
            configuration: true,
          },
        },
        configurationObject: {
          explainshellEndpoint: 'http://localhost:6000',
        },
      })
      const onHover = connection.onHover.mock.calls[0][0]

      const getHoverResult = (position: LSP.Position) =>
        onHover(
          {
            textDocument: {
              uri: FIXTURE_URI.OVERRIDE_SYMBOL,
            },
            position,
          },
          {} as any,
          {} as any,
        )

      const result1 = await getHoverResult({ line: 2, character: 1 })
      expect(result1).toBeDefined()
      expect((result1 as any)?.contents.value).toEqual('list directory contents')

      // return explain shell result for the arguments
      const result2 = await getHoverResult({ line: 2, character: 3 })
      expect(result2).toBeDefined()
      expect((result2 as any)?.contents.value).toEqual(
        '**\\-l** use a long listing format',
      )
    })
  })

  describe('onReferences', () => {
    async function getOnReferencesTestCase() {
      const { connection } = await initializeServer()
      const onReferences = connection.onReferences.mock.calls[0][0]

      const callOnReferences = ({
        includeDeclarationOfCurrentSymbol,
        uri,
        position,
      }: {
        includeDeclarationOfCurrentSymbol: boolean
        uri: string
        position: LSP.Position
      }) =>
        updateSnapshotUris(
          onReferences(
            {
              textDocument: {
                uri,
              },
              position,
              context: {
                includeDeclaration: includeDeclarationOfCurrentSymbol,
              },
            },
            {} as any,
            {} as any,
          ),
        )

      return {
        callOnReferences,
      }
    }

    it('returns null if the word is not found', async () => {
      const { callOnReferences } = await getOnReferencesTestCase()
      const result = await callOnReferences({
        position: { line: 34, character: 1 }, // empty line
        uri: FIXTURE_URI.INSTALL,
        includeDeclarationOfCurrentSymbol: true,
      })
      expect(result).toBeNull()
    })

    it('returns references to builtins and executables across the workspace', async () => {
      const { callOnReferences } = await getOnReferencesTestCase()
      const result = await callOnReferences({
        position: { line: 263, character: 5 }, // echo
        uri: FIXTURE_URI.INSTALL,
        includeDeclarationOfCurrentSymbol: true,
      })
      expect(Array.isArray(result)).toBe(true)
      if (Array.isArray(result)) {
        expect(result.length).toBeGreaterThan(50)
        expect(new Set(result.map((v) => v.uri)).size).toBeGreaterThan(5)
      }
    })

    it('returns references depending on the context flag', async () => {
      const { callOnReferences } = await getOnReferencesTestCase()

      const resultIncludingCurrentSymbol = await callOnReferences({
        position: { line: 50, character: 10 }, // npm_config_loglevel
        uri: FIXTURE_URI.INSTALL,
        includeDeclarationOfCurrentSymbol: true,
      })

      const resultExcludingCurrentSymbol = await callOnReferences({
        position: { line: 50, character: 10 }, // npm_config_loglevel
        uri: FIXTURE_URI.INSTALL,
        includeDeclarationOfCurrentSymbol: false,
      })

      expect(resultIncludingCurrentSymbol).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 19,
                "line": 40,
              },
              "start": {
                "character": 0,
                "line": 40,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 21,
                "line": 48,
              },
              "start": {
                "character": 2,
                "line": 48,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 26,
                "line": 50,
              },
              "start": {
                "character": 7,
                "line": 50,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 19,
                "line": 97,
              },
              "start": {
                "character": 0,
                "line": 97,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/renaming.sh",
          },
          {
            "range": {
              "end": {
                "character": 25,
                "line": 98,
              },
              "start": {
                "character": 6,
                "line": 98,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/renaming.sh",
          },
          {
            "range": {
              "end": {
                "character": 26,
                "line": 42,
              },
              "start": {
                "character": 7,
                "line": 42,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
        ]
      `)

      expect(resultExcludingCurrentSymbol).toMatchInlineSnapshot(`
        [
          {
            "range": {
              "end": {
                "character": 19,
                "line": 40,
              },
              "start": {
                "character": 0,
                "line": 40,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 21,
                "line": 48,
              },
              "start": {
                "character": 2,
                "line": 48,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/install.sh",
          },
          {
            "range": {
              "end": {
                "character": 19,
                "line": 97,
              },
              "start": {
                "character": 0,
                "line": 97,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/renaming.sh",
          },
          {
            "range": {
              "end": {
                "character": 25,
                "line": 98,
              },
              "start": {
                "character": 6,
                "line": 98,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/renaming.sh",
          },
          {
            "range": {
              "end": {
                "character": 26,
                "line": 42,
              },
              "start": {
                "character": 7,
                "line": 42,
              },
            },
            "uri": "file://__REPO_ROOT_FOLDER__/testing/fixtures/scope.sh",
          },
        ]
      `)
    })
  })

  describe('onWorkspaceSymbol', () => {
    it('responds to onWorkspaceSymbol', async () => {
      const { connection } = await initializeServer()

      const onWorkspaceSymbol = connection.onWorkspaceSymbol.mock.calls[0][0]

      async function lookupAndExpectNpmConfigLoglevelResult(query: string) {
        const result = await onWorkspaceSymbol(
          {
            query,
          },
          {} as any,
          {} as any,
        )

        expect(result).toEqual([
          {
            kind: expect.any(Number),
            location: {
              range: {
                end: { character: 27, line: 40 },
                start: { character: 0, line: 40 },
              },
              uri: expect.stringContaining('/testing/fixtures/install.sh'),
            },
            name: 'npm_config_loglevel',
          },
          {
            kind: expect.any(Number),
            location: {
              range: {
                end: { character: 26, line: 97 },
                start: { character: 0, line: 97 },
              },
              uri: expect.stringContaining('/testing/fixtures/renaming.sh'),
            },
            name: 'npm_config_loglevel',
          },
        ])
      }

      await lookupAndExpectNpmConfigLoglevelResult('npm_config_loglevel') // exact
      await lookupAndExpectNpmConfigLoglevelResult('config_log') // in the middle
      await lookupAndExpectNpmConfigLoglevelResult('npmloglevel') // fuzzy
    })
  })

  describe('onPrepareRename', () => {
    async function getPrepareRenameResult(
      line: LSP.uinteger,
      character: LSP.uinteger,
      { uri = FIXTURE_URI.RENAMING } = {},
    ) {
      const { connection } = await initializeServer()

      return connection.onPrepareRename.mock.calls[0][0](
        { textDocument: { uri }, position: { line, character } },
        {} as any,
      )
    }

    it.each([
      ['comment', 0, 17],
      ['empty line', 1, 0],
      ['special variable', 4, 7],
      ['underscore', 5, 0],
      ['positional parameter', 6, 7],
      ['invalidly named variable', 7, 2],
      ['string', 32, 24],
      ['reserved word', 32, 33],
      ['regular word', 88, 11],

      // Documents some of tree-sitter-bash's limitations when parsing
      // constructs that affect renaming; these may fail in the future when
      // parsing gets better.
      ['variable in let expression', 110, 4],
      ['variable in binary expression', 111, 9],
      ['variable in postfix expression', 111, 17],
    ])('returns null for non-renamable symbol: %s', async (_, line, character) => {
      expect(await getPrepareRenameResult(line, character)).toBeNull()
    })

    it('returns Range for renamable symbol', async () => {
      const HOME = await getPrepareRenameResult(23, 10)
      expect(HOME).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 11,
            "line": 23,
          },
          "start": {
            "character": 7,
            "line": 23,
          },
        }
      `)

      const ls = await getPrepareRenameResult(24, 0)
      expect(ls).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 2,
            "line": 24,
          },
          "start": {
            "character": 0,
            "line": 24,
          },
        }
      `)

      const somefunc = await getPrepareRenameResult(28, 6)
      expect(somefunc).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 8,
            "line": 28,
          },
          "start": {
            "character": 0,
            "line": 28,
          },
        }
      `)

      const readvar = await getPrepareRenameResult(2, 18, {
        uri: FIXTURE_URI.RENAMING_READ,
      })
      expect(readvar).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 20,
            "line": 2,
          },
          "start": {
            "character": 13,
            "line": 2,
          },
        }
      `)
    })
  })

  describe('onRenameRequest', () => {
    it('does not start a rename at an input declared later on the same line', async () => {
      const { connection, server } = await initializeServer({
        initializationOptions: { backgroundAnalysisMaxFiles: 0, shellcheckPath: '' },
      })
      const uri = 'file:///input-order.sh'
      const source = 'echo "$name"; read name; echo "$name"'
      const document = TextDocument.create(uri, 'shellscript', 1, source)
      await server.analyzeAndLintDocument(document)
      const edit = (await connection.onRenameRequest.mock.calls[0][0](
        {
          textDocument: { uri },
          position: document.positionAt(source.indexOf('$name') + 1),
          newName: 'renamed',
        },
        {} as any,
        {} as any,
      )) as LSP.WorkspaceEdit
      expect(TextDocument.applyEdits(document, edit.changes![uri])).toBe(
        'echo "$renamed"; read renamed; echo "$renamed"',
      )
    })

    async function getRenameRequestResult(
      line: LSP.uinteger,
      character: LSP.uinteger,
      {
        rootPath = '',
        includeAllWorkspaceSymbols = false,
        uri = FIXTURE_URI.RENAMING,
        newName = 'newName',
      } = {},
    ) {
      const { connection } = await initializeServer({
        rootPath: rootPath ? rootPath : undefined,
        capabilities: { workspace: { configuration: true } },
        configurationObject: { includeAllWorkspaceSymbols },
      })

      return updateSnapshotUris(
        await connection.onRenameRequest.mock.calls[0][0](
          {
            textDocument: { uri },
            position: { line, character },
            newName,
          },
          {} as any,
          {} as any,
        ),
      )
    }
    async function getFirstChangeRanges(
      promise: ReturnType<typeof getRenameRequestResult>,
    ) {
      return Object.values(
        ((await promise) as LSP.WorkspaceEdit).changes as {
          [uri: LSP.DocumentUri]: LSP.TextEdit[]
        },
      )[0].map((c) => c.range)
    }
    async function getChangeUris(promise: ReturnType<typeof getRenameRequestResult>) {
      return Object.keys(
        ((await promise) as LSP.WorkspaceEdit).changes as {
          [uri: LSP.DocumentUri]: LSP.TextEdit[]
        },
      )
    }
    function getRenameRequestResults(
      ...args: Parameters<typeof getRenameRequestResult>[]
    ) {
      return Promise.all(args.map((a) => getRenameRequestResult(...a)))
    }

    it.each(['_', '2', '1abc', 'ab%c'])(
      'throws an error for invalid variable name: %s',
      async (newName) => {
        await expect(getRenameRequestResult(11, 7, { newName })).rejects.toThrow()
      },
    )

    it.each(['$', 'new$name'])(
      'throws an error for invalid function name: %s',
      async (newName) => {
        await expect(getRenameRequestResult(12, 24, { newName })).rejects.toThrow()
      },
    )

    it('differentiates between variables and functions with the same name', async () => {
      const variableRanges = await getFirstChangeRanges(getRenameRequestResult(11, 7))
      const functionRanges = await getFirstChangeRanges(getRenameRequestResult(12, 24))

      expect(variableRanges).toHaveLength(4)
      expect(functionRanges).toHaveLength(2)
      expect(variableRanges).not.toContainEqual(functionRanges[0])
      expect(variableRanges).not.toContainEqual(functionRanges[1])
    })

    describe('File-wide rename', () => {
      it('returns correct WorkspaceEdits for undeclared symbols', async () => {
        const [HOME, ...HOMEs] = await getRenameRequestResults([23, 10], [24, 5])
        expect(HOME).toMatchSnapshot()
        for (const h of HOMEs) {
          expect(HOME).toStrictEqual(h)
        }

        const [ls, ...lss] = await getRenameRequestResults([24, 0], [29, 12], [30, 18])
        expect(ls).toMatchSnapshot()
        for (const l of lss) {
          expect(ls).toStrictEqual(l)
        }
      })

      it('returns correct WorkspaceEdits for globally scoped declarations', async () => {
        const [somefunc, ...somefuncs] = await getRenameRequestResults(
          [28, 5],
          [32, 11],
          [46, 8],
          [49, 3],
        )
        expect(somefunc).toMatchSnapshot()
        for (const s of somefuncs) {
          expect(somefunc).toStrictEqual(s)
        }

        const [somevar, ...somevars] = await getRenameRequestResults(
          [29, 2],
          [33, 12],
          [40, 9],
          [41, 7],
          [43, 23],
          [44, 9],
          [64, 10],
          [65, 13],
          [66, 3],
        )
        expect(somevar).toMatchSnapshot()
        for (const s of somevars) {
          expect(somevar).toStrictEqual(s)
        }

        const [othervar, ...othervars] = await getRenameRequestResults([30, 9], [34, 12])
        expect(othervar).toMatchSnapshot()
        for (const o of othervars) {
          expect(othervar).toStrictEqual(o)
        }
      })

      it('returns correct WorkspaceEdits for function-scoped declarations', async () => {
        const [somevar, ...somevars] = await getRenameRequestResults(
          [43, 11],
          [47, 2],
          [52, 15],
          [58, 14],
        )
        expect(somevar).toMatchSnapshot()
        for (const s of somevars) {
          expect(somevar).toStrictEqual(s)
        }

        const [somevarInsideSubshell, ...somevarsInsideSubshell] =
          await getRenameRequestResults([53, 17], [54, 13])
        expect(somevarInsideSubshell).toMatchSnapshot()
        for (const s of somevarsInsideSubshell) {
          expect(somevarInsideSubshell).toStrictEqual(s)
        }
      })

      it('returns correct WorkspaceEdits for subshell-scoped declarations', async () => {
        const [somevar, ...somevars] = await getRenameRequestResults(
          [65, 3],
          [68, 7],
          [76, 18],
          [83, 8],
        )
        expect(somevar).toMatchSnapshot()
        for (const s of somevars) {
          expect(somevar).toStrictEqual(s)
        }

        const [somevarInsideSubshell, ...somevarsInsideSubshell] =
          await getRenameRequestResults([71, 4], [72, 11])
        expect(somevarInsideSubshell).toMatchSnapshot()
        for (const s of somevarsInsideSubshell) {
          expect(somevarInsideSubshell).toStrictEqual(s)
        }

        const [somefunc, ...somefuncs] = await getRenameRequestResults([75, 10], [81, 5])
        expect(somefunc).toMatchSnapshot()
        for (const s of somefuncs) {
          expect(somefunc).toStrictEqual(s)
        }

        const [somevarInsideSomefunc, ...somevarsInsideSomefunc] =
          await getRenameRequestResults([77, 16], [78, 17])
        expect(somevarInsideSomefunc).toMatchSnapshot()
        for (const s of somevarsInsideSomefunc) {
          expect(somevarInsideSomefunc).toStrictEqual(s)
        }
      })

      it('returns correct WorkspaceEdits for variables within read commands', async () => {
        const [readvar, ...readvars] = await getRenameRequestResults(
          [2, 8, { uri: FIXTURE_URI.RENAMING_READ }],
          [2, 19, { uri: FIXTURE_URI.RENAMING_READ }],
          [2, 21, { uri: FIXTURE_URI.RENAMING_READ }],
          [3, 10, { uri: FIXTURE_URI.RENAMING_READ }],
          [3, 19, { uri: FIXTURE_URI.RENAMING_READ }],
          [6, 14, { uri: FIXTURE_URI.RENAMING_READ }],
          [7, 15, { uri: FIXTURE_URI.RENAMING_READ }],
          [8, 32, { uri: FIXTURE_URI.RENAMING_READ }],
          [9, 7, { uri: FIXTURE_URI.RENAMING_READ }],
          [11, 23, { uri: FIXTURE_URI.RENAMING_READ }],
          [12, 30, { uri: FIXTURE_URI.RENAMING_READ }],
          [13, 10, { uri: FIXTURE_URI.RENAMING_READ }],
          [15, 10, { uri: FIXTURE_URI.RENAMING_READ }],
          [16, 11, { uri: FIXTURE_URI.RENAMING_READ }],
          [17, 23, { uri: FIXTURE_URI.RENAMING_READ }],
          [17, 33, { uri: FIXTURE_URI.RENAMING_READ }],
        )
        expect(readvar).toMatchSnapshot()
        for (const r of readvars) {
          expect(readvar).toStrictEqual(r)
        }

        // Option-looking words after the first name are invalid destinations,
        // not new options; do not rename the words following them.
        const invalidDestinations = await getRenameRequestResults(
          [15, 31, { uri: FIXTURE_URI.RENAMING_READ }],
          [16, 30, { uri: FIXTURE_URI.RENAMING_READ }],
        )
        expect(invalidDestinations).toEqual([null, null])

        const [readloop, ...readloops] = await getRenameRequestResults(
          [21, 21, { uri: FIXTURE_URI.RENAMING_READ }],
          [23, 12, { uri: FIXTURE_URI.RENAMING_READ }],
        )
        expect(readloop).toMatchSnapshot()
        for (const r of readloops) {
          expect(readloop).toStrictEqual(r)
        }

        const [readscope, ...readscopes] = await getRenameRequestResults(
          [28, 8, { uri: FIXTURE_URI.RENAMING_READ }],
          [30, 11, { uri: FIXTURE_URI.RENAMING_READ }],
          [31, 12, { uri: FIXTURE_URI.RENAMING_READ }],
          [38, 15, { uri: FIXTURE_URI.RENAMING_READ }],
          [43, 9, { uri: FIXTURE_URI.RENAMING_READ }],
        )
        expect(readscope).toMatchSnapshot()
        for (const r of readscopes) {
          expect(readscope).toStrictEqual(r)
        }

        const [readscopeInsideFunction, ...readscopesInsideFunction] =
          await getRenameRequestResults(
            [33, 11, { uri: FIXTURE_URI.RENAMING_READ }],
            [34, 14, { uri: FIXTURE_URI.RENAMING_READ }],
            [35, 8, { uri: FIXTURE_URI.RENAMING_READ }],
          )
        expect(readscopeInsideFunction).toMatchSnapshot()
        for (const r of readscopesInsideFunction) {
          expect(readscopeInsideFunction).toStrictEqual(r)
        }

        const [readscopeInsideSubshell, ...readscopesInsideSubshell] =
          await getRenameRequestResults(
            [40, 14, { uri: FIXTURE_URI.RENAMING_READ }],
            [41, 10, { uri: FIXTURE_URI.RENAMING_READ }],
          )
        expect(readscopeInsideSubshell).toMatchSnapshot()
        for (const r of readscopesInsideSubshell) {
          expect(readscopeInsideSubshell).toStrictEqual(r)
        }
      })
    })

    describe('Workspace-wide rename', () => {
      it('returns correct WorkspaceEdits for sourced symbols', async () => {
        const [RED, ...REDs] = await getRenameRequestResults(
          [90, 0],
          [91, 8],
          [4, 7, { uri: FIXTURE_URI.SOURCING }],
          [4, 2, { uri: FIXTURE_URI.EXTENSION_INC }],
          [22, 3, { uri: FIXTURE_URI.EXTENSION_INC }],
        )
        expect(RED).toMatchSnapshot()
        for (const r of REDs) {
          expect(RED).toStrictEqual(r)
        }

        const [tagRelease, ...tagReleases] = await getRenameRequestResults(
          [93, 6, { rootPath: REPO_ROOT_FOLDER }],
          [94, 7, { rootPath: REPO_ROOT_FOLDER }],
          [18, 1, { rootPath: REPO_ROOT_FOLDER, uri: FIXTURE_URI.SOURCING }],
          [
            4,
            18,
            {
              rootPath: REPO_ROOT_FOLDER,
              uri: `file://${join(REPO_ROOT_FOLDER, 'scripts', 'tag-release.inc')}`,
            },
          ],
        )
        expect(tagRelease).toMatchSnapshot()
        for (const t of tagReleases) {
          expect(tagRelease).toStrictEqual(t)
        }
      })

      it('returns correct WorkspaceEdits for unsourced symbols when includeAllWorkspaceSymbols is false', async () => {
        const [npm_config_loglevel, ...npm_config_loglevels] =
          await getRenameRequestResults([97, 3], [98, 16])
        expect(npm_config_loglevel).toMatchSnapshot()
        for (const n of npm_config_loglevels) {
          expect(npm_config_loglevel).toStrictEqual(n)
        }

        const [f, ...fs] = await getRenameRequestResults([101, 0], [102, 0])
        expect(f).toMatchSnapshot()
        for (const instance of fs) {
          expect(f).toStrictEqual(instance)
        }
      })

      it('returns correct WorkspaceEdits for unsourced symbols when includeAllWorkspaceSymbols is true', async () => {
        const [npm_config_loglevel, ...npm_config_loglevels] =
          await getRenameRequestResults(
            [97, 3, { includeAllWorkspaceSymbols: true }],
            [98, 16, { includeAllWorkspaceSymbols: true }],
            [42, 9, { includeAllWorkspaceSymbols: true, uri: FIXTURE_URI.SCOPE }],
            [40, 6, { includeAllWorkspaceSymbols: true, uri: FIXTURE_URI.INSTALL }],
            [48, 14, { includeAllWorkspaceSymbols: true, uri: FIXTURE_URI.INSTALL }],
            [50, 24, { includeAllWorkspaceSymbols: true, uri: FIXTURE_URI.INSTALL }],
          )
        expect(npm_config_loglevel).toMatchSnapshot()
        for (const n of npm_config_loglevels) {
          expect(npm_config_loglevel).toStrictEqual(n)
        }

        const [f, ...fs] = await getRenameRequestResults(
          [101, 0, { includeAllWorkspaceSymbols: true }],
          [102, 0, { includeAllWorkspaceSymbols: true }],
          [7, 0, { includeAllWorkspaceSymbols: true, uri: FIXTURE_URI.SCOPE }],
          [33, 0, { includeAllWorkspaceSymbols: true, uri: FIXTURE_URI.SCOPE }],
        )
        expect(f).toMatchSnapshot()
        for (const instance of fs) {
          expect(f).toStrictEqual(instance)
        }
      })
    })

    // These may fail in the future when tree-sitter-bash's parsing gets better
    // or when the rename symbol implementation is improved.
    describe('Edge or not covered cases', () => {
      it('does not include some variables typed as word', async () => {
        const iRanges = await getFirstChangeRanges(getRenameRequestResult(106, 4))
        // This should be 6 if all instances within let, postfix, and binary
        // expressions are included.
        expect(iRanges.length).toBe(3)
      })

      it('includes incorrect number of symbols for complex scopes and nesting', async () => {
        const varRanges = await getFirstChangeRanges(getRenameRequestResult(118, 8))
        // This should only be 2 if `$var` from `3` is not included.
        expect(varRanges.length).toBe(3)

        const localFuncRanges = await getFirstChangeRanges(getRenameRequestResult(138, 5))
        // This should be 2 if the instance of `localFunc` in `callerFunc` is
        // also included.
        expect(localFuncRanges.length).toBe(1)
      })

      it('only takes into account subshells created with ( and )', async () => {
        const pipelinevarRanges = await getFirstChangeRanges(
          getRenameRequestResult(144, 7),
        )
        // This should only be 1 if pipeline subshell scoping is recognized.
        expect(pipelinevarRanges.length).toBe(2)
      })

      it('does not take into account sourcing location and scope', async () => {
        const FOOUris = await getChangeUris(getRenameRequestResult(148, 8))
        // This should only be 1 if sourcing after a symbol does not affect it.
        expect(FOOUris.length).toBe(2)

        const hello_worldUris = await getChangeUris(getRenameRequestResult(154, 6))
        // This should only be 1 if sourcing inside an uncalled function does
        // not affect symbols outside of it.
        expect(hello_worldUris.length).toBe(2)

        const PATH_INPUTUris = await getChangeUris(getRenameRequestResult(157, 9))
        // This should only be 1 if sourcing inside a subshell does not affect
        // symbols outside of it.
        expect(PATH_INPUTUris.length).toBe(2)
      })
    })
  })
})
