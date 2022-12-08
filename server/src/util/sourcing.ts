import * as fs from 'fs'
import * as path from 'path'
import * as LSP from 'vscode-languageserver'
import * as Parser from 'web-tree-sitter'

import { untildify } from './fs'

// Until the grammar supports sourcing, we use this little regular expression
const SOURCED_FILES_REG_EXP = /^(?:\t|[ ])*(?:source|[.])\s*(\S*)/gm

/**
 * Analysis the given file content and returns a set of URIs that are
 * sourced. Note that the URIs are not resolved.
 */
export function getSourcedUris({
  fileContent,
  fileUri,
  rootPath,
}: {
  fileContent: string
  fileUri: string
  rootPath: string | null
}): Set<string> {
  const uris: Set<string> = new Set([])
  let match: RegExpExecArray | null
  const rootPaths = [path.dirname(fileUri), rootPath].filter(Boolean) as string[]

  while ((match = SOURCED_FILES_REG_EXP.exec(fileContent)) !== null) {
    const word = match[1]
    const sourcedUri = getSourcedUri({ rootPaths, word })
    if (sourcedUri) {
      uris.add(sourcedUri)
    }
  }

  return uris
}

/**
 * Investigates if the given position is a path to a sourced file and maps it
 * to a location. Useful for jump to definition.
 * @returns an optional location
 */
export function getSourcedLocation({
  position,
  rootPath,
  tree,
  uri,
  word,
}: {
  position: { line: number; character: number }
  rootPath: string | null
  tree: Parser.Tree
  uri: string
  word: string
}): LSP.Location | null {
  // NOTE: when a word is a file path to a sourced file, we return a location to
  // that file.
  if (tree.rootNode) {
    const node = tree.rootNode.descendantForPosition({
      row: position.line,
      column: position.character,
    })

    if (!node || node.text.trim() !== word) {
      throw new Error('Implementation error: word was not found at the given position')
    }

    const isSourced = node.previousNamedSibling
      ? ['.', 'source'].includes(node.previousNamedSibling.text.trim())
      : false

    const rootPaths = [path.dirname(uri), rootPath].filter(Boolean) as string[]

    const sourcedUri = isSourced ? getSourcedUri({ word, rootPaths }) : null

    if (sourcedUri) {
      return LSP.Location.create(sourcedUri, LSP.Range.create(0, 0, 0, 0))
    }
  }

  return null
}

const stripQuotes = (path: string): string => {
  const first = path[0]
  const last = path[path.length - 1]

  if (first === last && [`"`, `'`].includes(first)) {
    return path.slice(1, -1)
  }

  return path
}

/**
 * Tries to parse the given path and returns a URI if possible.
 * - Filters out dynamic sources
 * - Converts a relative paths to absolute paths
 */
function getSourcedUri({
  rootPaths,
  word,
}: {
  rootPaths: string[]
  word: string
}): string | null {
  // NOTE: improvements:
  // - we could try to resolve the path
  // - "If filename does not contain a slash, file names in PATH are used to find
  //   the directory containing filename." (see https://ss64.com/osx/source.html)
  let unquotedPath = stripQuotes(word)

  if (unquotedPath.includes('$')) {
    // NOTE: we don't support dynamic sourcing
    return null
  }

  if (unquotedPath.startsWith('~')) {
    unquotedPath = untildify(unquotedPath)
  }

  if (unquotedPath.startsWith('/')) {
    if (fs.existsSync(unquotedPath)) {
      return `file://${unquotedPath}`
    }
    return null
  }

  // resolve  relative path
  for (const rootPath of rootPaths) {
    const potentialPath = path.join(rootPath.replace('file://', ''), unquotedPath)

    // check if path is a file
    if (fs.existsSync(potentialPath)) {
      return `file://${potentialPath}`
    }
  }

  return null
}
