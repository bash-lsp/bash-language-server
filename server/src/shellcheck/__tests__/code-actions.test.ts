import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'

import * as LSP from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Parser } from 'web-tree-sitter'

import { initializeParser } from '../../parser'
import { getCodeActions } from '../code-actions'
import { ShellCheckResult } from '../types'

const URI = 'file:///disable-actions.sh'
let parser: Parser

beforeAll(async () => {
  parser = await initializeParser()
})
afterAll(() => parser.delete())

function lint(text: string): ShellCheckResult['comments'] {
  let output: string
  try {
    output = execFileSync(
      'shellcheck',
      ['--norc', '--shell=bash', '--format=json1', '-'],
      {
        input: text,
        encoding: 'utf8',
      },
    )
  } catch (error) {
    if ((error as { status: number }).status !== 1) throw error
    output = (error as { stdout: string }).stdout
  }
  return JSON.parse(output).comments
}

function actionsFor(text: string, code = 2154) {
  const document = TextDocument.create(URI, 'shellscript', 1, text)
  const comment = lint(text).find(
    (comment) => comment.code === code && !comment.message.startsWith('bar '),
  )
  expect(comment).toBeDefined()
  const diagnostic: LSP.Diagnostic = {
    code: `SC${code}`,
    source: 'shellcheck',
    message: comment!.message,
    range: LSP.Range.create(
      comment!.line - 1,
      comment!.column - 1,
      comment!.endLine - 1,
      comment!.endColumn - 1,
    ),
    data: { id: 'diagnostic' },
  }
  const tree = parser.parse(text)!
  try {
    return {
      document,
      actions: getCodeActions({
        document,
        rootNode: tree.rootNode,
        result: { diagnostics: [diagnostic], codeActions: {} },
      }).diagnostic,
    }
  } finally {
    tree.delete()
  }
}

function apply(document: TextDocument, action: LSP.CodeAction): string {
  expect(action.kind).toBe(LSP.CodeActionKind.QuickFix)
  expect(action.diagnostics).toHaveLength(1)
  return TextDocument.applyEdits(document, action.edit!.changes![URI])
}

describe('ShellCheck suppression actions', () => {
  it.each([
    ['simple command', 'echo "$foo"', '# shellcheck disable=SC2154\necho "$foo"'],
    [
      'indentation',
      'if true; then\n\t echo "$foo"\nfi',
      '\t # shellcheck disable=SC2154\n\t echo "$foo"',
    ],
    [
      'continuation',
      'echo \\\n  "$foo"',
      '# shellcheck disable=SC2154\necho \\\n  "$foo"',
    ],
    ['continued assignment', 'A=1 \\\nB="$foo" env', '# shellcheck disable=SC2154\nA=1'],
    [
      'pipeline',
      'echo hello |\n  cat "$foo"',
      '# shellcheck disable=SC2154\necho hello |',
    ],
    ['and/or list', 'true &&\n  echo "$foo"', '# shellcheck disable=SC2154\ntrue &&'],
    [
      'redirection',
      'echo hello > \\\n  "$foo"',
      '# shellcheck disable=SC2154\necho hello >',
    ],
    [
      'multiline string',
      'echo "hello\n$foo"',
      '# shellcheck disable=SC2154\necho "hello',
    ],
    ['heredoc', 'cat <<EOF\n$foo\nEOF', '# shellcheck disable=SC2154\ncat <<EOF'],
    [
      'command substitution',
      'value=$(\n  echo "$foo"\n)',
      '  # shellcheck disable=SC2154\n  echo "$foo"',
    ],
    [
      'if condition',
      'if [ "$foo" = yes ]; then :; fi',
      '# shellcheck disable=SC2154\nif [',
    ],
    [
      'elif condition',
      'if false; then :; elif [ "$foo" = yes ]; then :; fi',
      '# shellcheck disable=SC2154\nif false;',
    ],
    [
      'else body',
      'if false; then :; else\n  echo "$foo"\nfi',
      '  # shellcheck disable=SC2154\n  echo "$foo"',
    ],
    [
      'loop body',
      'while true; do\n  echo "$foo"\ndone',
      '  # shellcheck disable=SC2154\n  echo "$foo"',
    ],
    [
      'case pattern',
      'case x in\n  "$foo") :;;\nesac',
      '# shellcheck disable=SC2154\ncase x in',
    ],
    [
      'case body',
      'case x in\n  x)\n    echo "$foo";;\nesac',
      '    # shellcheck disable=SC2154\n    echo "$foo"',
    ],
    ['inline function body', 'f() { echo "$foo"; }', '# shellcheck disable=SC2154\nf()'],
    [
      'second inline command',
      'f() {\n  :; echo "$foo"\n}',
      '# shellcheck disable=SC2154\nf()',
    ],
    [
      'comment-like string',
      'echo "# shellcheck disable=SC2000"\necho "$foo"',
      '# shellcheck disable=SC2154\necho "$foo"',
    ],
  ])('suppresses a %s without changing other commands', (_name, source, expected) => {
    const text = `#!/bin/bash\n: before\n${source}\necho "$bar"\n`
    const { document, actions } = actionsFor(text)
    expect(actions.map(({ title }) => title)).toEqual([
      'Disable ShellCheck rule SC2154 for this command',
      'Disable ShellCheck rule SC2154 for the entire file',
    ])
    const local = apply(document, actions[0])
    expect(local).toContain(expected)
    // ShellCheck must still report the unrelated variable, without new parse errors.
    expect(
      lint(local)
        .filter(({ code }) => code === 2154)
        .map(({ message }) => message),
    ).toEqual(['bar is referenced but not assigned.'])
    expect(lint(local).some(({ level }) => level === 'error')).toBe(false)
    const tree = parser.parse(local)!
    expect(tree.rootNode.hasError).toBe(false)
    tree.delete()

    const file = apply(document, actions[1])
    expect(file).toContain('#!/bin/bash\n# shellcheck disable=SC2154\n')
    expect(lint(file).filter(({ code }) => code === 2154)).toEqual([])
  })

  it('places array suppressions before the assignment', () => {
    const { document, actions } = actionsFor(
      '#!/bin/bash\n: before\nitems=(\n  $foo\n)\nother=( $bar )',
      2206,
    )
    const local = apply(document, actions[0])
    expect(local).toContain('# shellcheck disable=SC2206\nitems=(')
    expect(lint(local).filter(({ code }) => code === 2206)).toHaveLength(1)
    expect(
      lint(apply(document, actions[1])).filter(({ code }) => code === 2206),
    ).toHaveLength(0)
  })

  it.each(['', '#!/bin/bash\n', '#!/bin/bash\n\n# License\n\n'])(
    'offers only file scope for the first command after %j',
    (header) => {
      const { document, actions } = actionsFor(`${header}echo "$foo"\necho "$bar"`)
      expect(actions.map(({ title }) => title)).toEqual([
        'Disable ShellCheck rule SC2154 for the entire file',
      ])
      expect(lint(apply(document, actions[0]))).toEqual([])
    },
  )

  it('allows local scope inside the first function', () => {
    const { document, actions } = actionsFor(
      '#!/bin/bash\nf() {\n  echo "$foo"\n}\necho "$bar"',
    )
    expect(apply(document, actions[0])).toContain('  # shellcheck disable=SC2154\n  echo')
  })

  it('merges directives in the correct scope and preserves comments and ranges', () => {
    const text =
      '#!/bin/bash\n# License\n# shellcheck disable=SC1000-SC1002\n: before\n  # shellcheck disable=2000,SC3000 # reason\n  # another comment\n  echo "$foo"\necho "$bar"'
    const { document, actions } = actionsFor(text)
    const local = apply(document, actions[0])
    expect(local).toContain(
      '  # shellcheck disable=2000,SC2154,SC3000 # reason\n  # another comment',
    )
    expect(local).toContain('# shellcheck disable=SC1000-SC1002\n')
    expect(lint(local).filter(({ code }) => code === 2154)).toHaveLength(1)
    const file = apply(document, actions[1])
    expect(file).toContain('# shellcheck disable=SC1000-SC1002,SC2154\n')
    expect(file).toContain('# shellcheck disable=2000,SC3000 # reason')
    expect(lint(file).filter(({ code }) => code === 2154)).toHaveLength(0)
  })

  it('preserves CRLF and a missing final newline', () => {
    const text = '#!/bin/bash\r\n: before\r\n\techo "$foo"'
    const { document, actions } = actionsFor(text, 1017)
    const file = apply(document, actions[actions.length - 1])
    expect(file).toBe(
      '#!/bin/bash\r\n# shellcheck disable=SC1017\r\n: before\r\n\techo "$foo"',
    )
    // ShellCheck diagnoses CRLF before it can analyze the command. Exercise the
    // command edit with the equivalent LF diagnostic to verify text preservation.
    const lf = text.replace(/\r/g, '')
    const localAction = actionsFor(lf).actions[0]
    const tree = parser.parse(text)!
    try {
      const actions = getCodeActions({
        document,
        rootNode: tree.rootNode,
        result: {
          diagnostics: localAction.diagnostics!,
          codeActions: {},
        },
      }).diagnostic
      expect(apply(document, actions[0])).toBe(
        '#!/bin/bash\r\n: before\r\n\t# shellcheck disable=SC2154\r\n\techo "$foo"',
      )
    } finally {
      tree.delete()
    }
  })

  it('does not insert before an unrelated command on the same line', () => {
    const { actions } = actionsFor('#!/bin/bash\n: before\n:; echo "$foo"')
    expect(actions.map(({ title }) => title)).toEqual([
      'Disable ShellCheck rule SC2154 for the entire file',
    ])
  })

  it('preserves ShellCheck fixes and provides file scope when no tree is available', () => {
    const document = TextDocument.create(URI, 'shellscript', 1, '#!/bin/unsupported')
    const diagnostic: LSP.Diagnostic = {
      message: 'Unsupported shell',
      code: 'SC1071',
      range: LSP.Range.create(0, 0, 0, 18),
      data: { id: 'unsupported' },
    }
    const fix: LSP.CodeAction = { title: 'Existing fix' }
    const actions = getCodeActions({
      document,
      result: {
        diagnostics: [diagnostic],
        codeActions: { unsupported: fix },
      },
    }).unsupported
    expect(actions[0]).toBe(fix)
    expect(apply(document, actions[1])).toBe(
      '#!/bin/unsupported\n# shellcheck disable=SC1071\n',
    )
  })
})
