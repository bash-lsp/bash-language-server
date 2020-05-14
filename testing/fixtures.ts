import * as fs from 'fs'
import * as path from 'path'
import * as LSP from 'vscode-languageserver'

export const FIXTURE_FOLDER = path.join(__dirname, './fixtures/')

function getDocument(uri: string) {
  return LSP.TextDocument.create(
    'foo',
    'bar',
    0,
    fs.readFileSync(uri.replace('file://', ''), 'utf8'),
  )
}

export const FIXTURE_URI = {
  INSTALL: `file://${path.join(FIXTURE_FOLDER, 'install.sh')}`,
  ISSUE101: `file://${path.join(FIXTURE_FOLDER, 'issue101.sh')}`,
  ISSUE206: `file://${path.join(FIXTURE_FOLDER, 'issue206.sh')}`,
  MISSING_NODE: `file://${path.join(FIXTURE_FOLDER, 'missing-node.sh')}`,
  PARSE_PROBLEMS: `file://${path.join(FIXTURE_FOLDER, 'parse-problems.sh')}`,
  SOURCING: `file://${path.join(FIXTURE_FOLDER, 'sourcing.sh')}`,
  COMMENT_DOC: `file://${path.join(FIXTURE_FOLDER, 'comment-doc-on-hover.sh')}`,
}

export const FIXTURE_DOCUMENT = {
  INSTALL: getDocument(FIXTURE_URI.INSTALL),
  ISSUE101: getDocument(FIXTURE_URI.ISSUE101),
  MISSING_NODE: getDocument(FIXTURE_URI.MISSING_NODE),
  PARSE_PROBLEMS: getDocument(FIXTURE_URI.PARSE_PROBLEMS),
  SOURCING: getDocument(FIXTURE_URI.SOURCING),
  COMMENT_DOC: getDocument(FIXTURE_URI.COMMENT_DOC),
}

export default FIXTURE_DOCUMENT
