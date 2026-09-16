#!/usr/bin/env bash

set -euo pipefail

function tagRelease {
  local tag=$1
  local commit="${2:-HEAD}"
  local remoteTag
  remoteTag=$(git ls-remote --tags origin "refs/tags/${tag}")

  if [ -z "$remoteTag" ]; then
    if ! git show-ref --verify --quiet "refs/tags/${tag}"; then
      if ! git cat-file -e "${commit}^{commit}"; then
        git fetch origin "$commit"
      fi
      git tag -a "${tag}" -m "Release ${tag}" "$commit"
    fi
    git push origin "refs/tags/${tag}"
  fi

  if ! gh release view "$tag" > /dev/null 2>&1; then
    # Compare against the previous version of this package, not the other package.
    local prefix="${tag%%-[0-9]*}-"
    local previousTag
    previousTag=$(git ls-remote --tags --refs --sort=version:refname origin "refs/tags/${prefix}*" |
      awk -v current="refs/tags/${tag}" '
        $2 == current { exit }
        { previous = $2 }
        END { sub("refs/tags/", "", previous); print previous }
      ')

    set -- "$tag" --verify-tag --generate-notes --title "$tag"
    if [ -n "$previousTag" ]; then
      set -- "$@" --notes-start-tag "$previousTag"
    fi
    gh release create "$@"
  fi
}
