#!/usr/bin/env bash

set -euo pipefail

function tagRelease {
  tag=$1
  git tag -a "${tag}" -m "Release ${tag}"
  git push origin "${tag}"
}
