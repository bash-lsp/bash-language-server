#!/usr/bin/env bash

set -euo pipefail

yarn run clean
yarn install
yarn run check:bail

cd vscode-client && npx vsce publish -p $VSCE_TOKEN || echo 'Deploy failed'
