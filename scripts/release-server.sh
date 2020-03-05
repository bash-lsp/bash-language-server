#!/usr/bin/env bash

set -euo pipefail

source ./scripts/tag-release.inc

version=$(cat server/package.json | jq -r .version)
tag="server-${version}"

publishedVersion=$(yarn info bash-language-server --json | jq -r .data.\"dist-tags\".latest)

if [ "$version" = "$publishedVersion" ]; then
    echo "Newest server version is already deployed."
    exit 0
fi

yarn run clean
yarn install
yarn run verify:bail

cd server
npm publish
tagRelease $tag
