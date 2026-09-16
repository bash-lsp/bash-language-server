import { readFile } from 'fs/promises'
import { Language, Parser } from 'web-tree-sitter'

export async function initializeParser(): Promise<Parser> {
  await Parser.init()
  const parser = new Parser()

  /**
   * See https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web#generate-wasm-language-files
   *
   * To compile and use a new tree-sitter-bash version:
   *    bash scripts/upgrade-tree-sitter.sh
   */
  const wasm = await readFile(`${__dirname}/../tree-sitter-bash.wasm`)
  const lang = await Language.load(wasm)

  parser.setLanguage(lang)
  return parser
}
