#!/usr/bin/env bash

set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
build_dir=$(mktemp -d)
trap 'rm -rf "$build_dir"' EXIT

cli_version=0.27.0
# web-tree-sitter 0.24.x supports parser ABIs 13 and 14.
parser_abi=14

git clone --depth 1 https://github.com/tree-sitter/tree-sitter-bash "$build_dir/grammar"
cd "$build_dir/grammar"
parser_commit=$(git rev-parse HEAD)

pnpm --package="tree-sitter-cli@$cli_version" dlx tree-sitter generate --abi "$parser_abi"
pnpm --package="tree-sitter-cli@$cli_version" dlx tree-sitter build --wasm --output "$build_dir/tree-sitter-bash.wasm"

# Check the artifact with the server's installed runtime before replacing it.
node - "$repo_dir" "$build_dir/tree-sitter-bash.wasm" <<'JS'
const [repoDir, wasmPath] = process.argv.slice(2)
const Parser = require(require.resolve('web-tree-sitter', { paths: [`${repoDir}/server`] }))

async function verify() {
  await Parser.init()
  const parser = new Parser()
  parser.setLanguage(await Parser.Language.load(wasmPath))
  const tree = parser.parse('echo "$HOME"\n')
  if (!tree || tree.rootNode.hasError) {
    throw new Error('The generated Bash parser failed its smoke test')
  }
  tree.delete()
  parser.delete()
}

verify().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
JS

printf '"https://api.github.com/repos/tree-sitter/tree-sitter-bash/git/commits/%s"\ntree-sitter-cli "%s"\nparser ABI %s\n' \
  "$parser_commit" "$cli_version" "$parser_abi" > "$build_dir/parser.info"
cp "$build_dir/tree-sitter-bash.wasm" "$repo_dir/server/tree-sitter-bash.wasm"
cp "$build_dir/parser.info" "$repo_dir/server/parser.info"
