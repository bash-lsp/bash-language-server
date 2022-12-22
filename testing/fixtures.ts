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
  INSTALL: `file://${path.join(FIXTURE_FOLDER, 'install.sh')}`,
  ISSUE101: `file://${path.join(FIXTURE_FOLDER, 'issue101.sh')}`,
  ISSUE206: `file://${path.join(FIXTURE_FOLDER, 'issue206.sh')}`,
  MISSING_EXTENSION: `file://${path.join(FIXTURE_FOLDER, 'extension')}`,
  MISSING_NODE: `file://${path.join(FIXTURE_FOLDER, 'missing-node.sh')}`,
  PARSE_PROBLEMS: `file://${path.join(FIXTURE_FOLDER, 'parse-problems.sh')}`,
  SOURCING: `file://${path.join(FIXTURE_FOLDER, 'sourcing.sh')}`,
  COMMENT_DOC: `file://${path.join(FIXTURE_FOLDER, 'comment-doc-on-hover.sh')}`,
  OVERRIDE_SYMBOL: `file://${path.join(FIXTURE_FOLDER, 'override-executable-symbol.sh')}`,
}

export const FIXTURE_DOCUMENT: Record<FIXTURE_KEY, TextDocument> = (
  Object.keys(FIXTURE_URI) as Array<FIXTURE_KEY>
).reduce((acc, cur: FIXTURE_KEY) => {
  acc[cur] = getDocument(FIXTURE_URI[cur])
  return acc
}, {} as any)

export const REPO_ROOT_FOLDER = path.resolve(path.join(FIXTURE_FOLDER, '../..'))
