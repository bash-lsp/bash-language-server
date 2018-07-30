#!/usr/bin/env bash

set -euo pipefail

version=$(cat server/package.json | jq -r .version)
tag="server-${version}"

git tag -a "${tag}" -m "Release ${version} of the bash-language-server package"
git push origin "${tag}"

cd server && npm publish
