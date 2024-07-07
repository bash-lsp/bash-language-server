import * as fs from 'fs'
import * as path from 'path'
import { TextDocument } from 'vscode-languageserver-textdocument'

export const FIXTURE_FOLDER = path.join(__dirname, './fixtures/')

function getDocument(uri: string) {
  return TextDocument.create(
    uri,
    'shellscript',
    0,
    fs.readFileSync(uri.replace('file://', ''), 'utf8'),
  )
}

type FIXTURE_KEY = keyof typeof FIXTURE_URI

export const FIXTURE_URI = {
  COMMENT_DOC: `file://${path.join(FIXTURE_FOLDER, 'comment-doc-on-hover.sh')}`,
  CRASH: `file://${path.join(FIXTURE_FOLDER, 'crash.zsh')}`,
  INSTALL: `file://${path.join(FIXTURE_FOLDER, 'install.sh')}`,
  ISSUE101: `file://${path.join(FIXTURE_FOLDER, 'issue101.sh')}`,
  ISSUE206: `file://${path.join(FIXTURE_FOLDER, 'issue206.sh')}`,
  MISSING_EXTENSION: `file://${path.join(FIXTURE_FOLDER, 'extension')}`,
  EXTENSION_INC: `file://${path.join(FIXTURE_FOLDER, 'extension.inc')}`,
  MISSING_NODE: `file://${path.join(FIXTURE_FOLDER, 'missing-node.sh')}`,
  OPTIONS: `file://${path.join(FIXTURE_FOLDER, 'options.sh')}`,
  OVERRIDE_SYMBOL: `file://${path.join(FIXTURE_FOLDER, 'override-executable-symbol.sh')}`,
  PARSE_PROBLEMS: `file://${path.join(FIXTURE_FOLDER, 'parse-problems.sh')}`,
  SCOPE: `file://${path.join(FIXTURE_FOLDER, 'scope.sh')}`,
  SHELLCHECK_SOURCE: `file://${path.join(FIXTURE_FOLDER, 'shellcheck', 'source.sh')}`,
  SHELLCHECK_SHELL_DIRECTIVE: `file://${path.join(
    FIXTURE_FOLDER,
    'shellcheck',
    'shell-directive.bash',
  )}`,
  SHFMT: `file://${path.join(FIXTURE_FOLDER, 'shfmt.sh')}`,
  SOURCING: `file://${path.join(FIXTURE_FOLDER, 'sourcing.sh')}`,
  SOURCING2: `file://${path.join(FIXTURE_FOLDER, 'sourcing2.sh')}`,
  RENAMING: `file://${path.join(FIXTURE_FOLDER, 'renaming.sh')}`,
}

export const FIXTURE_DOCUMENT: Record<FIXTURE_KEY, TextDocument> = (
  Object.keys(FIXTURE_URI) as Array<FIXTURE_KEY>
).reduce((acc, cur: FIXTURE_KEY) => {
  acc[cur] = getDocument(FIXTURE_URI[cur])
  return acc
}, {} as any)

export const REPO_ROOT_FOLDER = path.resolve(path.join(FIXTURE_FOLDER, '../..'))

export function updateSnapshotUris<
  T extends Record<string, any> | Array<any> | null | undefined,
>(data: T): T {
  if (data != null) {
    if (Array.isArray(data)) {
      data.forEach((el) => updateSnapshotUris(el))
      return data
    }

    if (typeof data === 'object') {
      if (data.changes) {
        for (const key in data.changes) {
          data.changes[key.replace(REPO_ROOT_FOLDER, '__REPO_ROOT_FOLDER__')] =
            data.changes[key]
          delete data.changes[key]
        }

        return data
      }

      if (data.uri) {
        data.uri = data.uri.replace(REPO_ROOT_FOLDER, '__REPO_ROOT_FOLDER__')
      }
      Object.values(data).forEach((child) => {
        if (Array.isArray(child)) {
          child.forEach((el) => updateSnapshotUris(el))
        } else if (typeof child === 'object' && child != null) {
          updateSnapshotUris(child)
        }
      })
    }
  }

  return data
}
