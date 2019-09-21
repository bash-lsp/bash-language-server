import * as Parser from 'web-tree-sitter'

// yarn tree-sitter build-wasm node_modules/tree-sitter-bash

export async function initializeParser(): Promise<Parser> {
  await Parser.init()
  const parser = new Parser()
  const lang = await Parser.Language.load(`${__dirname}/../tree-sitter-bash.wasm`)

  parser.setLanguage(lang)
  return parser
}
