#!/usr/bin/env bash

set -euox pipefail

cd server
pnpm add web-tree-sitter
pnpm add --save-dev tree-sitter-cli https://github.com/tree-sitter/tree-sitter-bash
npx tree-sitter build --wasm node_modules/tree-sitter-bash

curl 'https://api.github.com/repos/tree-sitter/tree-sitter-bash/commits/master' | jq .commit.url > parser.info
echo "tree-sitter-cli $(cat package.json | jq '.devDependencies["tree-sitter-cli"]')" >> parser.info

pnpm remove tree-sitter-cli tree-sitter-bash

