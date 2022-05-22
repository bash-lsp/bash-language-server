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
   *    cd server
   *    yarn add web-tree-sitter
   *    yarn add --dev tree-sitter-bash tree-sitter-cli
   *    npx tree-sitter build-wasm node_modules/tree-sitter-bash
   *
   * Note down the versions (from the package.json) below and then run
   *    yarn remove tree-sitter-bash tree-sitter-cli
   *
   * The current files was compiled with:
   * "tree-sitter-bash": "^0.19.0",
   * "tree-sitter-cli": "^0.20.0"
   */
  const lang = await Parser.Language.load(`${__dirname}/../tree-sitter-bash.wasm`)

  parser.setLanguage(lang)
  return parser
}
