#!/bin/sh

source ./issue101.sh

RED=`tput setaf 1`
GREEN=`tput setaf 2`
local BLUE=`tput setaf 4` # local at the root is still exposed to the global scope
export BOLD=`tput bold`

{ # non colors in a group
  RESET=`tput sgr0`
}

extensionFunc() {
  LOCAL_VARIABLE='local'

  innerExtensionFunc() {
    echo $LOCAL_VARIABLE
  }
}

if [ "${ENV}" = "prod" ]; then
  RED="" # Ignored as we do not flowtrace.
fi

: "${FILE_PATH:="/default/file"}"

printf 'Printing %s\n' "$FILE_PATH"
