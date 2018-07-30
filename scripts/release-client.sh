#!/usr/bin/env bash

set -euo pipefail

version=$(cat server/package.json | jq -r .version)

cd vscode-client && vsce publish ${version}
