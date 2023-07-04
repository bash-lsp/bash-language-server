#!/usr/bin/env bash

set -euo pipefail

source ./scripts/tag-release.inc

version=$(cat server/package.json | jq -r .version)
tag="server-${version}"

publishedVersion=$(pnpm info bash-language-server --json | jq -r .\"dist-tags\".latest)

if [ "$version" = "$publishedVersion" ]; then
    echo "Newest server version is already deployed."
    exit 0
fi

pnpm clean
pnpm install
pnpm verify:bail

cd server
npm publish
# npm publish --tag beta # for releasing beta versions
tagRelease $tag
