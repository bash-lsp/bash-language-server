#!/usr/bin/env bash

set -euo pipefail

source ./scripts/tag-release.inc

version=$(cat vscode-client/package.json | jq -r .version)
tag="vscode-client-${version}"

yarn run clean
yarn install
yarn run verify:bail

cd vscode-client

# NOTE: it would be much nicer if we could detect which version was deployed...
npx vsce publish -p $VSCE_TOKEN && tagRelease $tag || echo 'Deploy failed, probably there was no changes'
