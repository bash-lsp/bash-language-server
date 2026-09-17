import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Node as SyntaxNode } from 'web-tree-sitter'

import { addDisabledRule } from './directive'
import { LintingResult } from './index'

const COMMAND_TYPES = new Set([
  'command',
  'declaration_command',
  'unset_command',
  'variable_assignment',
  'test_command',
  'negated_command',
  'pipeline',
  'list',
  'redirected_statement',
  'compound_statement',
  'subshell',
  'if_statement',
  'while_statement',
  'for_statement',
  'c_style_for_statement',
  'case_statement',
  'function_definition',
])

// These nodes contain complete commands. Other parents require climbing out of
// an expression, pipeline, redirection, or function declaration first.
const COMMAND_CONTAINERS = new Set([
  'program',
  'compound_statement',
  'subshell',
  'if_statement',
  'elif_clause',
  'else_clause',
  'while_statement',
  'do_group',
  'case_item',
  'command_substitution',
  'process_substitution',
])

/** Add suppression actions to ShellCheck's fixes using the already analyzed tree. */
export function getCodeActions({
  document,
  rootNode,
  result,
}: {
  document: TextDocument
  rootNode?: SyntaxNode
  result: LintingResult
}): Record<string, LSP.CodeAction[]> {
  const actions: Record<string, LSP.CodeAction[]> = {}
  const text = document.getText()
  const lines = text.split(/\r\n|\n|\r/)
  const newline = text.match(/\r\n|\n|\r/)?.[0] || '\n'
  const headerComments: SyntaxNode[] = []
  let firstCommand: SyntaxNode | undefined
  for (const node of rootNode?.namedChildren || []) {
    if (node.type !== 'comment') {
      firstCommand = node
      break
    }
    headerComments.push(node)
  }

  for (const diagnostic of result.diagnostics) {
    const { id } = diagnostic.data
    const fix = result.codeActions[id]
    actions[id] = fix ? [fix] : []
    const code = String(diagnostic.code)
    if (!/^SC\d+$/.test(code)) continue

    const addAction = (scope: string, edit: LSP.TextEdit | null) => {
      if (!edit) return
      actions[id].push({
        title: `Disable ShellCheck rule ${code} for ${scope}`,
        kind: LSP.CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: { changes: { [document.uri]: [edit] } },
      })
    }

    const command = rootNode && findCommand(rootNode, diagnostic.range.start, lines)
    // Before the first top-level command, ShellCheck directives are file-wide.
    // Never present that edit as a command-local suppression.
    if (command && command.id !== firstCommand?.id) {
      const comments: SyntaxNode[] = []
      let previous = command.previousNamedSibling
      while (previous?.type === 'comment') {
        comments.unshift(previous)
        previous = previous.previousNamedSibling
      }
      const line = command.startPosition.row
      const indentation = lines[line].match(/^[ \t]*/)?.[0] || ''
      addAction('this command', disableEdit(code, comments, line, indentation))
    }

    const fileLine = lines[0].startsWith('#!') ? 1 : 0
    addAction('the entire file', disableEdit(code, headerComments, fileLine, ''))
  }
  return actions

  function disableEdit(
    code: string,
    comments: SyntaxNode[],
    insertLine: number,
    indentation: string,
  ): LSP.TextEdit | null {
    for (const comment of comments) {
      const line = comment.startPosition.row
      // Do not rewrite trailing comments or continued directives.
      if (!/^[ \t]*$/.test(lines[line].slice(0, comment.startPosition.column))) continue
      const updated = addDisabledRule(lines[line], code)
      if (updated === lines[line]) return null
      if (updated !== null) {
        return LSP.TextEdit.replace(
          LSP.Range.create(line, 0, line, lines[line].length),
          updated,
        )
      }
    }
    // A shebang-only document may not yet have a trailing newline.
    const position =
      insertLine < lines.length
        ? LSP.Position.create(insertLine, 0)
        : document.positionAt(text.length)
    const prefix = insertLine < lines.length ? '' : newline
    return LSP.TextEdit.insert(
      position,
      `${prefix}${indentation}# shellcheck disable=${code}${newline}`,
    )
  }
}

function findCommand(
  rootNode: SyntaxNode,
  position: LSP.Position,
  lines: string[],
): SyntaxNode | null {
  let node: SyntaxNode | null = rootNode.descendantForPosition({
    row: position.line,
    column: position.character,
  })
  while (node && node.type !== 'program') {
    if (
      COMMAND_TYPES.has(node.type) &&
      !node.hasError &&
      COMMAND_CONTAINERS.has(node.parent?.type || '') &&
      /^[ \t]*$/.test(lines[node.startPosition.row].slice(0, node.startPosition.column))
    ) {
      return node
    }
    node = node.parent
  }
  return null
}
