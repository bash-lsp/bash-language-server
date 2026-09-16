import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Parser } from 'web-tree-sitter'

import Analyzer from '../analyser'
import { initializeParser } from '../parser'
import { Logger } from '../util/logger'
import * as disk from '../util/read-file'
import WorkspaceIndex from '../workspace-index'

let directory: string
let parser: Parser
let analyzer: Analyzer
let index: WorkspaceIndex
const opened = new Set<string>()
const selection = { globPattern: '**/*.sh', backgroundAnalysisMaxFiles: 10 }

function write(name: string, text: string) {
  const path = join(directory, name)
  fs.writeFileSync(path, text)
  return pathToFileURL(path).href
}

function names() {
  return analyzer
    .findDeclarationsWithFuzzySearch('')
    .map((symbol) => symbol.name)
    .sort()
}

beforeEach(async () => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
  directory = fs.mkdtempSync(join(tmpdir(), 'bash-index-'))
  parser = await initializeParser()
  analyzer = new Analyzer({
    parser,
    workspaceFolder: directory,
    includeAllWorkspaceSymbols: true,
  })
  index = new WorkspaceIndex(analyzer, directory, (uri) => opened.has(uri))
})

afterEach(() => {
  opened.clear()
  parser.delete()
  fs.rmSync(directory, { recursive: true, force: true })
  jest.restoreAllMocks()
})

it('refreshes changed files and reconciles create, rename and delete events', async () => {
  const uri = write('old.sh', 'old=value')
  await index.configure(selection)
  expect(names()).toEqual(['old'])
  write('old.sh', 'changed=value')
  await index.update([{ uri, type: LSP.FileChangeType.Changed }])
  expect(names()).toEqual(['changed'])
  fs.renameSync(join(directory, 'old.sh'), join(directory, 'new.sh'))
  const renamed = pathToFileURL(join(directory, 'new.sh')).href
  await index.update([
    { uri: renamed, type: LSP.FileChangeType.Created },
    { uri, type: LSP.FileChangeType.Deleted },
  ])
  expect(index.getFileUris()).toEqual([renamed])
  expect(analyzer.getDocument(uri)).toBeUndefined()
  fs.unlinkSync(join(directory, 'new.sh'))
  await index.update([{ uri: renamed, type: LSP.FileChangeType.Deleted }])
  expect(names()).toEqual([])
})

it('respects selection limits and retries split rename creations on rescan', async () => {
  const uri = write('old.sh', 'old=value')
  await index.configure({ ...selection, backgroundAnalysisMaxFiles: 1 })
  const next = write('new.sh', 'next=value')
  await index.update([{ uri: next, type: LSP.FileChangeType.Created }])
  expect(index.getFileUris()).toHaveLength(1)
  fs.unlinkSync(join(directory, 'old.sh'))
  await index.update([{ uri, type: LSP.FileChangeType.Deleted }])
  expect(index.getFileUris()).toEqual([next])
  expect(names()).toEqual(['next'])
  await index.configure({ ...selection, backgroundAnalysisMaxFiles: 0 })
  expect(index.getFileUris()).toEqual([])
  expect(names()).toEqual([])
})

it('preserves open buffers and reloads disk when they close', async () => {
  const uri = write('open.sh', 'disk=value')
  await index.configure(selection)
  opened.add(uri)
  analyzer.analyze({
    uri,
    document: TextDocument.create(uri, 'shellscript', 2, 'editor=value'),
  })
  write('open.sh', 'changed=value')
  await index.update([{ uri, type: LSP.FileChangeType.Changed }])
  expect(names()).toEqual(['editor'])
  opened.delete(uri)
  await index.close(uri)
  expect(names()).toEqual(['changed'])
})

it('evicts an open file excluded by configuration once it closes', async () => {
  const uri = write('open.sh', 'old=value')
  await index.configure(selection)
  opened.add(uri)
  await index.configure({ ...selection, backgroundAnalysisMaxFiles: 0 })
  expect(names()).toEqual(['old'])
  opened.delete(uri)
  await index.close(uri)
  expect(names()).toEqual([])
})

it('retries a selected file when its shebang changes to a supported dialect', async () => {
  const uri = write('dialect.sh', '#!/usr/bin/python\nold=value')
  await index.configure(selection)
  expect(index.getFileUris()).toEqual([])
  write('dialect.sh', '#!/bin/bash\ncurrent=value')
  await index.update([{ uri, type: LSP.FileChangeType.Changed }])
  expect(index.getFileUris()).toEqual([uri])
  expect(names()).toEqual(['current'])
})

it('evicts unsafe disk replacements and retries a later regular file', async () => {
  const uri = write('file.sh', 'old=value')
  await index.configure(selection)
  fs.unlinkSync(join(directory, 'file.sh'))
  fs.mkdirSync(join(directory, 'file.sh'))
  await index.update([{ uri, type: LSP.FileChangeType.Changed }])
  expect(names()).toEqual([])
  expect(index.getFileUris()).toEqual([])
  fs.rmdirSync(join(directory, 'file.sh'))
  write('file.sh', 'current=value')
  await index.update([{ uri, type: LSP.FileChangeType.Changed }])
  expect(names()).toEqual(['current'])
  expect(index.getFileUris()).toEqual([uri])
})

it('retries out-of-glob source changes cancelled by reconfiguration', async () => {
  const library = write('library', 'old=value')
  const consumer = write('consumer.sh', 'source ./library')
  await index.configure(selection)
  analyzer.getAllVariables({ uri: consumer, position: { line: 1, character: 0 } })
  expect(analyzer.getDocument(library)).toBeDefined()
  write('library', 'current=value')
  let finish!: (value: string) => void
  let started!: () => void
  const reading = new Promise<void>((resolve) => {
    started = resolve
  })
  jest.spyOn(disk, 'readFileForAnalysis').mockImplementationOnce(() => {
    started()
    return new Promise((resolve) => {
      finish = resolve as (value: string) => void
    })
  })
  const refresh = index.update([{ uri: library, type: LSP.FileChangeType.Changed }])
  await reading
  const reconfigured = index.configure({ ...selection, backgroundAnalysisMaxFiles: 5 })
  finish('stale=value')
  await Promise.all([refresh, reconfigured])
  expect(analyzer.getDocument(library)?.getText()).toBe('current=value')
})

it('does not evict newer lazy analysis when an older async read fails', async () => {
  const library = write('library.sh', 'current=value')
  const consumer = pathToFileURL(join(directory, 'consumer.sh')).href
  let reject!: (error: Error) => void
  let started!: () => void
  const reading = new Promise<void>((resolve) => {
    started = resolve
  })
  jest.spyOn(disk, 'readFileForAnalysis').mockImplementationOnce(() => {
    started()
    return new Promise((_resolve, rejectRead) => {
      reject = rejectRead
    })
  })
  const refresh = index.configure(selection)
  await reading
  analyzer.analyze({
    uri: consumer,
    document: TextDocument.create(consumer, 'shellscript', 1, 'source ./library.sh'),
  })
  analyzer.getAllVariables({ uri: consumer, position: { line: 1, character: 0 } })
  const newer = analyzer.getDocument(library)
  expect(newer).toBeDefined()
  reject(new Error('older read failed'))
  await refresh
  expect(analyzer.getDocument(library)).toBe(newer)
  expect(index.getFileUris()).toEqual([library])
})

it('does not overwrite an editor buffer opened during an async read', async () => {
  const uri = write('open.sh', 'disk=value')
  let finish!: (value: string) => void
  let started!: () => void
  const reading = new Promise<void>((resolve) => {
    started = resolve
  })
  jest.spyOn(disk, 'readFileForAnalysis').mockImplementationOnce(() => {
    started()
    return new Promise((resolve) => {
      finish = resolve as (value: string) => void
    })
  })
  const refresh = index.configure(selection)
  await reading
  opened.add(uri)
  analyzer.analyze({
    uri,
    document: TextDocument.create(uri, 'shellscript', 2, 'editor=value'),
  })
  finish('stale=value')
  await refresh
  expect(names()).toEqual(['editor'])
})

it('retries selected files when configuration changes during a read', async () => {
  const uri = write('pending.sh', 'current=value')
  let finish!: (value: string) => void
  let started!: () => void
  const reading = new Promise<void>((resolve) => {
    started = resolve
  })
  jest.spyOn(disk, 'readFileForAnalysis').mockImplementationOnce(() => {
    started()
    return new Promise((resolve) => {
      finish = resolve as (value: string) => void
    })
  })
  const refresh = index.configure(selection)
  await reading
  const reconfigured = index.configure({ ...selection, backgroundAnalysisMaxFiles: 1 })
  finish('stale=value')
  await Promise.all([refresh, reconfigured])
  expect(index.getFileUris()).toEqual([uri])
  expect(names()).toEqual(['current'])
})

it('queues a newer file event while a read is in progress', async () => {
  const uri = write('file.sh', 'initial=value')
  await index.configure(selection)
  let finish!: (value: string) => void
  let started!: () => void
  const reading = new Promise<void>((resolve) => {
    started = resolve
  })
  jest.spyOn(disk, 'readFileForAnalysis').mockImplementationOnce(() => {
    started()
    return new Promise((resolve) => {
      finish = resolve as (value: string) => void
    })
  })
  const first = index.update([{ uri, type: LSP.FileChangeType.Changed }])
  await reading
  write('file.sh', 'latest=value')
  const second = index.update([{ uri, type: LSP.FileChangeType.Changed }])
  finish('stale=value')
  await Promise.all([first, second])
  expect(names()).toEqual(['latest'])
})

it('updates source relationships for extensionless files outside the glob', async () => {
  const consumer = write('consumer.sh', 'source ./library\nprovided')
  await index.configure(selection)
  expect(analyzer.findAllSourcedUris({ uri: consumer }).size).toBe(0)
  const library = write('library', 'provided() { :; }')
  await index.update([{ uri: library, type: LSP.FileChangeType.Created }])
  expect([...analyzer.findAllSourcedUris({ uri: consumer })]).toContain(library)
  fs.unlinkSync(join(directory, 'library'))
  await index.update([{ uri: library, type: LSP.FileChangeType.Deleted }])
  expect(analyzer.findAllSourcedUris({ uri: consumer }).size).toBe(0)
})

it('drops files outside a new glob while retaining an open editor buffer', async () => {
  const uri = write('old.sh', 'old=value')
  const next = write('new.inc', 'next=value')
  await index.configure(selection)
  opened.add(uri)
  await index.configure({ ...selection, globPattern: '**/*.inc' })
  expect(index.getFileUris()).toEqual([next])
  expect(names()).toEqual(['next', 'old'])
})
