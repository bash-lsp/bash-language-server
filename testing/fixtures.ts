import * as fs from 'fs'
import * as path from 'path'

const base = path.join(__dirname, './fixtures/')

const FIXTURES = {
  INSTALL: fs.readFileSync(path.join(base, 'install.sh'), 'utf8'),
  PARSE_PROBLEMS: fs.readFileSync(path.join(base, 'parse-problems.sh'), 'utf8'),
}

export default FIXTURES
