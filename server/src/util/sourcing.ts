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

      const strValue = TreeSitterUtil.resolveStaticString(argumentNode)
      if (strValue !== null) {
        return {
          sourcedPath: strValue,
        }
      }

      // Strip one leading dynamic section.
      if (argumentNode.type === 'string' && argumentNode.namedChildren.length === 1) {
        const [variableNode] = argumentNode.namedChildren
        if (TreeSitterUtil.isExpansion(variableNode)) {
          const stringContents = argumentNode.text.slice(1, -1)
          if (stringContents.startsWith(`${variableNode.text}/`)) {
            return {
              sourcedPath: `.${stringContents.slice(variableNode.text.length)}`,
            }
          }
        }
      }

      if (argumentNode.type === 'concatenation') {
        // Strip one leading dynamic section from a concatenation node.
        const sourcedPath = resolveSourceFromConcatenation(argumentNode)
        if (sourcedPath) {
          return {
            sourcedPath,
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

/*
 * Resolves the source path from a concatenation node, stripping a leading dynamic directory segment.
 * Returns null if the source path can't be statically determined after stripping a segment.
 * Note: If a non-concatenation node is passed, null will be returned. This is likely a programmer error.
 */
function resolveSourceFromConcatenation(node: Parser.SyntaxNode): string | null {
  if (node.type !== 'concatenation') return null
  const stringValue = TreeSitterUtil.resolveStaticString(node)
  if (stringValue !== null) return stringValue // This string is fully static.

  const values: string[] = []
  // Since the string must begin with the variable, the variable must be in the first child.
  const [firstNode, ...rest] = node.namedChildren
  // The first child is static, this means one of the other children is not!
  if (TreeSitterUtil.resolveStaticString(firstNode) !== null) return null

  // if the string is unquoted, the first child is the variable, so there's no more text in it.
  if (!TreeSitterUtil.isExpansion(firstNode)) {
    if (firstNode.namedChildCount > 1) return null // Only one variable is allowed.
    // Since the string must begin with the variable, the variable must be first child.
    const variableNode = firstNode.namedChildren[0] // Get the variable (quoted case)
    // This is command substitution!
    if (!TreeSitterUtil.isExpansion(variableNode)) return null
    const stringContents = firstNode.text.slice(1, -1)
    // The string doesn't start with the variable!
    if (!stringContents.startsWith(variableNode.text)) return null
    // Get the remaining static portion the string
    values.push(stringContents.slice(variableNode.text.length))
  }

  for (const child of rest) {
    const value = TreeSitterUtil.resolveStaticString(child)
    // The other values weren't statically determinable!
    if (value === null) return null
    values.push(value)
  }

  // Join all our found static values together.
  const staticResult = values.join('')
  // The path starts with slash, so trim the leading variable and replace with a dot
  if (staticResult.startsWith('/')) return `.${staticResult}`
  // The path doesn't start with a slash, so it's invalid
  // PERF: can we fail earlier than this?
  return null
}
