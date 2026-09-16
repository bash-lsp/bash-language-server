import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Node as SyntaxNode } from 'web-tree-sitter'

import { BashCompletionItem, CompletionItemDataType } from './types'
import { range, resolveStaticString } from './util/tree-sitter'

type Context = { range: LSP.Range; prefix: string; quote: string }

/** A literal first argument only; edits always replace the complete syntax node. */
function sourceContext(
  document: TextDocument,
  root: SyntaxNode,
  position: LSP.Position,
): Context | null {
  const offset = document.offsetAt(position)
  const text = document.getText()
  for (const command of root.descendantsOfType('command')) {
    const name = command.childForFieldName('name')
    if (!name || !['source', '.'].includes(name.text)) continue
    const argument = command.childrenForFieldName('argument')[0]
    if (argument) {
      if (
        offset < argument.startIndex ||
        offset > argument.endIndex ||
        argument.startPosition.row !== argument.endPosition.row
      )
        continue
      if (
        !['word', 'string', 'raw_string'].includes(argument.type) ||
        resolveStaticString(argument) === null ||
        argument.text.includes('\\')
      )
        continue
      const quote = ['string', 'raw_string'].includes(argument.type)
        ? argument.text[0]
        : ''
      let prefix = text.slice(argument.startIndex + quote.length, offset)
      if (quote && offset === argument.endIndex) prefix = prefix.slice(0, -1)
      return { range: range(argument), prefix, quote }
    }

    if (offset <= name.endIndex) continue
    const gap = text.slice(name.endIndex, offset)
    if (/^[\t ]+$/.test(gap))
      return { range: LSP.Range.create(position, position), prefix: '', quote: '' }

    // An unfinished quote is an ERROR sibling. Only edit it at EOF on one line;
    // never replace the first line of a multiline token and leave a suffix behind.
    const error = command.nextNamedSibling
    const token = error?.text.trimStart() ?? ''
    const tokenStart = error ? error.endIndex - token.length : 0
    if (
      error?.type === 'ERROR' &&
      error.endIndex === text.length &&
      error.startPosition.row === error.endPosition.row &&
      offset >= tokenStart &&
      offset <= error.endIndex &&
      /^[\t ]+$/.test(text.slice(name.endIndex, tokenStart)) &&
      /^["'][^"'`$\\\n]*$/.test(token)
    ) {
      return {
        range: LSP.Range.create(
          document.positionAt(tokenStart),
          document.positionAt(error.endIndex),
        ),
        prefix: text.slice(tokenStart + 1, offset),
        quote: token[0],
      }
    }
  }
  return null
}

function shellQuote(value: string, quote: string): string {
  if (quote === '"') return `"${value.replace(/[\\"$`]/g, '\\$&')}"`
  if (quote === "'" || !/^[a-zA-Z0-9_./-]+$/.test(value))
    return `'${value.replace(/'/g, "'\\''")}'`
  return value
}

/** Uses the index catalog, with no filesystem reads during completion. */
export function completeSourcePath({
  document,
  root,
  position,
  fileUris,
}: {
  document: TextDocument
  root: SyntaxNode
  position: LSP.Position
  fileUris: string[]
}): BashCompletionItem[] | null {
  if (!document.uri.startsWith('file:')) return null
  const context = sourceContext(document, root, position)
  if (!context) return null
  const directory = path.dirname(fileURLToPath(document.uri))
  const prefix = context.prefix.replace(/^\.\//, '')
  return fileUris
    .filter((uri) => uri !== document.uri && uri.startsWith('file:'))
    .flatMap((uri) => {
      const relative = path
        .relative(directory, fileURLToPath(uri))
        .split(path.sep)
        .join('/')
      if (
        path.isAbsolute(relative) ||
        !relative.startsWith(prefix) ||
        /[\r\n]/.test(relative)
      )
        return []
      const label = relative.startsWith('../') ? relative : `./${relative}`
      const newText = shellQuote(label, context.quote)
      return [
        {
          label,
          kind: LSP.CompletionItemKind.File,
          detail:
            'Relative to this script’s directory; source uses the shell’s working directory at runtime.',
          data: { type: CompletionItemDataType.File },
          filterText:
            document.getText({ start: context.range.start, end: position }) +
            relative.slice(prefix.length),
          textEdit: { range: context.range, newText },
        },
      ]
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}
