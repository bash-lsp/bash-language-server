#!/usr/bin/env bash

set -euo pipefail

source ./scripts/tag-release.inc

version=$(cat vscode-client/package.json | jq -r .version)
tag="vscode-client-${version}"

pnpm clean
pnpm install
pnpm verify:bail

cd vscode-client

npx @vscode/vsce@2.26.0 publish --skip-duplicate -p $VSCE_TOKEN 
tagRelease $tag || echo "Tag update failed, likely already exists"
