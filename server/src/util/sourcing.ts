import * as path from 'path'
import * as LSP from 'vscode-languageserver'
import * as Parser from 'web-tree-sitter'

import { untildify } from './fs'

// Until the grammar supports sourcing, we use this little regular expression
const SOURCED_FILES_REG_EXP = /^(?:\t|[ ])*(?:source|[.])\s*(\S*)/gm

export function getSourcedUris({
  fileContent,
  fileUri,
}: {
  fileContent: string
  fileUri: string
}): Set<string> {
  const uris: Set<string> = new Set([])
  let match: RegExpExecArray | null

  while ((match = SOURCED_FILES_REG_EXP.exec(fileContent)) !== null) {
    const relativePath = match[1]
    const sourcedUri = getSourcedUri({ relativePath, uri: fileUri })
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
  tree,
  position,
  uri,
  word,
}: {
  tree: Parser.Tree
  position: { line: number; character: number }
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

    const sourcedUri = isSourced ? getSourcedUri({ relativePath: word, uri }) : null

    if (sourcedUri) {
      return LSP.Location.create(sourcedUri, LSP.Range.create(0, 0, 0, 0))
    }
  }

  return null
}

const mapPathToUri = (path: string): string => path.replace('file:', 'file://')

const stripQuotes = (path: string): string => {
  const first = path[0]
  const last = path[path.length - 1]

  if (first === last && [`"`, `'`].includes(first)) {
    return path.slice(1, -1)
  }

  return path
}

const getSourcedUri = ({
  relativePath,
  uri,
}: {
  relativePath: string
  uri: string
}): string | null => {
  // NOTE: improvements:
  // - we could try to resolve the path
  // - "If filename does not contain a slash, file names in PATH are used to find
  //   the directory containing filename." (see https://ss64.com/osx/source.html)
  const unquotedRelativePath = stripQuotes(relativePath)

  if (unquotedRelativePath.includes('$')) {
    return null
  }

  const resultPath = unquotedRelativePath.startsWith('~')
    ? untildify(unquotedRelativePath)
    : path.join(path.dirname(uri), unquotedRelativePath)

  return mapPathToUri(resultPath)
}
