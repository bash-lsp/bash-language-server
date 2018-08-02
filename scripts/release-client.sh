#!/usr/bin/env bash

set -euo pipefail

version=$(cat server/package.json | jq -r .version)

yarn && yarn run check:bail

cd vscode-client && vsce publish ${version}
