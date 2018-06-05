import * as fs from 'fs'
import * as path from 'path'
import * as LSP from 'vscode-languageserver'

const base = path.join(__dirname, './fixtures/')

const FIXTURES = {
  INSTALL: LSP.TextDocument.create('foo', 'bar', 0, fs.readFileSync(path.join(base, 'install.sh'), 'utf8')),
  PARSE_PROBLEMS: LSP.TextDocument.create('foo', 'bar', 0, fs.readFileSync(path.join(base, 'parse-problems.sh'), 'utf8')),
}

export default FIXTURES
