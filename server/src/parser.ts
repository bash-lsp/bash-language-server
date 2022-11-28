import * as Parser from 'web-tree-sitter'

const _global: any = global

export async function initializeParser(): Promise<Parser> {
  if (_global.fetch) {
    // NOTE: temporary workaround for emscripten node 18 support.
    // emscripten is used for compiling tree-sitter to wasm.
    // https://github.com/emscripten-core/emscripten/issues/16915
    delete _global.fetch
  }

  await Parser.init()
  const parser = new Parser()

  /**
   * See https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web#generate-wasm-language-files
   *
   * To compile and use a new tree-sitter-bash version:
   *    sh scripts/upgrade-tree-sitter.sh
   */
  const lang = await Parser.Language.load(`${__dirname}/../tree-sitter-bash.wasm`)

  parser.setLanguage(lang)
  return parser
}
