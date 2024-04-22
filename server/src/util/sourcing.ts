import * as fs from 'fs'
import * as path from 'path'
import * as LSP from 'vscode-languageserver'
import * as Parser from 'web-tree-sitter'

import { parseShellCheckDirective } from '../shellcheck/directive'
import { discriminate } from './discriminate'
import { untildify } from './fs'
import * as TreeSitterUtil from './tree-sitter'

const SOURCING_COMMANDS = ['source', '.']

export type SourceCommand = {
  range: LSP.Range
  uri: string | null // resolved URIs
  error: string | null
}

/**
 * Analysis the given tree for source commands.
 */
export function getSourceCommands({
  fileUri,
  rootPath,
  tree,
}: {
  fileUri: string
  rootPath: string | null
  tree: Parser.Tree
}): SourceCommand[] {
  const sourceCommands: SourceCommand[] = []

  const rootPaths = [path.dirname(fileUri), rootPath].filter(Boolean) as string[]

  TreeSitterUtil.forEach(tree.rootNode, (node) => {
    const sourcedPathInfo = getSourcedPathInfoFromNode({ node })

    if (sourcedPathInfo) {
      const { sourcedPath, parseError } = sourcedPathInfo
      const uri = sourcedPath ? resolveSourcedUri({ rootPaths, sourcedPath }) : null

      sourceCommands.push({
        range: TreeSitterUtil.range(node),
        uri,
        error: uri ? null : parseError || 'failed to resolve path',
      })
    }

    return true
  })

  return sourceCommands
}

function getSourcedPathInfoFromNode({
  node,
}: {
  node: Parser.SyntaxNode
}): null | { sourcedPath?: string; parseError?: string } {
  if (node.type === 'command') {
    const [commandNameNode, argumentNode] = node.namedChildren

    if (!commandNameNode || !argumentNode) {
      return null
    }

    if (
      commandNameNode.type === 'command_name' &&
      SOURCING_COMMANDS.includes(commandNameNode.text)
    ) {
      const previousCommentNode =
        node.previousSibling?.type === 'comment' ? node.previousSibling : null

      if (previousCommentNode?.text.includes('shellcheck')) {
        const directives = parseShellCheckDirective(previousCommentNode.text)
        const sourcedPath = directives.find(discriminate('type', 'source'))?.path

        if (sourcedPath === '/dev/null') {
          return null
        }

        if (sourcedPath) {
          return {
            sourcedPath,
          }
        }

        const isNotFollowErrorDisabled = !!directives
          .filter(discriminate('type', 'disable'))
          .flatMap(({ rules }) => rules)
          .find((rule) => rule === 'SC1091')

        if (isNotFollowErrorDisabled) {
          return null
        }

        const rootFolder = directives.find(discriminate('type', 'source-path'))?.path
        if (rootFolder && rootFolder !== 'SCRIPTDIR' && argumentNode.type === 'word') {
          return {
            sourcedPath: path.join(rootFolder, argumentNode.text),
          }
        }
      }

      if (argumentNode.type === 'word') {
        return {
          sourcedPath: argumentNode.text,
        }
      }

      if (argumentNode.type === 'string' || argumentNode.type === 'raw_string') {
        const children = argumentNode.namedChildren
        if (
          children.length === 0 ||
          (children.length === 1 && children[0].type === 'string_content')
        ) {
          return {
            sourcedPath: argumentNode.text.slice(1, -1),
          }
        }
      }

      // TODO: we could try to parse any ShellCheck "source "directive
      // # shellcheck source=src/examples/config.sh
      return {
        parseError: `non-constant source not supported`,
      }
    }
  }

  return null
}

/**
 * Tries to resolve the given sourced path and returns a URI if possible.
 * - Converts a relative paths to absolute paths
 * - Converts a tilde path to an absolute path
 * - Resolves the path
 *
 * NOTE: for future improvements:
 * "If filename does not contain a slash, file names in PATH are used to find
 *  the directory containing filename." (see https://ss64.com/osx/source.html)
 */
function resolveSourcedUri({
  rootPaths,
  sourcedPath,
}: {
  rootPaths: string[]
  sourcedPath: string
}): string | null {
  if (sourcedPath.startsWith('~')) {
    sourcedPath = untildify(sourcedPath)
  }

  if (sourcedPath.startsWith('/')) {
    if (fs.existsSync(sourcedPath)) {
      return `file://${sourcedPath}`
    }
    return null
  }

  // resolve  relative path
  for (const rootPath of rootPaths) {
    const potentialPath = path.join(rootPath.replace('file://', ''), sourcedPath)

    // check if path is a file
    if (fs.existsSync(potentialPath)) {
      return `file://${potentialPath}`
    }
  }

  return null
}
