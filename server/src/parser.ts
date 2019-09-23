import * as Parser from 'web-tree-sitter'

export async function initializeParser(): Promise<Parser> {
  await Parser.init()
  const parser = new Parser()

  // NOTE: see https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web#generate-wasm-language-files
  const lang = await Parser.Language.load(`${__dirname}/../tree-sitter-bash.wasm`)

  parser.setLanguage(lang)
  return parser
}
