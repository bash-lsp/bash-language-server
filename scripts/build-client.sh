#!/usr/bin/env bash

set -euo pipefail

export npm_config_target=1.2.3
# The architecture of Electron, can be ia32 or x64.
export npm_config_arch=x64
export npm_config_target_arch=x64
# Download headers for Electron.
export npm_config_disturl=https://atom.io/download/electron
# Tell node-pre-gyp that we are building for Electron.
export npm_config_runtime=electron

cd vscode-client
rm -rf node_modules
yarn install

vsce package --yarn -o bash-ide.vsix

# code --uninstall-extension mads-hartmann.bash-ide-vscode
code --install-extension bash-ide.vsix
