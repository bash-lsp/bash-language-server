import * as Parser from 'web-tree-sitter'

export async function initializeParser(): Promise<Parser> {
  await Parser.init()
  const parser = new Parser()

  /**
   * See https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web#generate-wasm-language-files
   *
   * To compile:
   *  yarn add --dev tree-sitter-cli
   *  npx tree-sitter build-wasm node_modules/tree-sitter-bash
   *
   * The current files was compiled with:
   * "tree-sitter-bash": "^0.16.0",
   * "tree-sitter-cli": "^0.15.9"
   */
  const lang = await Parser.Language.load(`${__dirname}/../tree-sitter-bash.wasm`)

  parser.setLanguage(lang)
  return parser
}
