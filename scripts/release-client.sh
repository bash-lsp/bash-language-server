#!/usr/bin/env bash

set -euo pipefail

source ./scripts/tag-release.inc

version=$(jq -r .version vscode-client/package.json)
tag="vscode-client-${version}"

pnpm clean
pnpm install
pnpm verify:bail

cd vscode-client

npx @vscode/vsce@2.32.0 publish --skip-duplicate -p "$VSCE_TOKEN"
tagRelease "$tag"
