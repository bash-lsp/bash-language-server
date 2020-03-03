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
  MISSING_NODE: `file://${path.join(FIXTURE_FOLDER, 'missing-node.sh')}`,
  ISSUE101: `file://${path.join(FIXTURE_FOLDER, 'issue101.sh')}`,
  INSTALL: `file://${path.join(FIXTURE_FOLDER, 'install.sh')}`,
  PARSE_PROBLEMS: `file://${path.join(FIXTURE_FOLDER, 'parse-problems.sh')}`,
}

export const FIXTURE_DOCUMENT = {
  MISSING_NODE: getDocument(FIXTURE_URI.MISSING_NODE),
  ISSUE101: getDocument(FIXTURE_URI.ISSUE101),
  INSTALL: getDocument(FIXTURE_URI.INSTALL),
  PARSE_PROBLEMS: getDocument(FIXTURE_URI.PARSE_PROBLEMS),
}

export default FIXTURE_DOCUMENT
