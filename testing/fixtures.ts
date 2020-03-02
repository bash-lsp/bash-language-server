import * as fs from 'fs'
import * as path from 'path'
import * as LSP from 'vscode-languageserver'

export const FIXTURE_FOLDER = path.join(__dirname, './fixtures/')

function getFixture(filename: string) {
  return LSP.TextDocument.create(
    'foo',
    'bar',
    0,
    fs.readFileSync(path.join(FIXTURE_FOLDER, filename), 'utf8'),
  )
}

const FIXTURES = {
  MISSING_NODE: getFixture('missing-node.sh'),
  ISSUE101: getFixture('issue101.sh'),
  INSTALL: getFixture('install.sh'),
  PARSE_PROBLEMS: getFixture('parse-problems.sh'),
}

export default FIXTURES
