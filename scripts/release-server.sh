#!/usr/bin/env bash

set -euo pipefail

source ./scripts/tag-release.inc

version=$(jq -r .version server/package.json)
tag="server-${version}"

publishedVersion=$(pnpm info bash-language-server --json | jq -r .\"dist-tags\".latest)

if [ "$version" = "$publishedVersion" ]; then
    echo "Newest server version is already deployed."
    # Finish any missing tag or GitHub release after a partial deployment.
    publishedCommit=$(pnpm info "bash-language-server@${version}" --json | jq -er '.gitHead | select(type == "string" and test("^[0-9a-f]{40}$"))')
    tagRelease "$tag" "$publishedCommit"
    exit 0
fi

pnpm clean
pnpm install
pnpm verify:bail

cd server
npm publish
# npm publish --tag beta # for releasing beta versions
tagRelease "$tag"
