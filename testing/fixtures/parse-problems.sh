#!/bin/sh
# set -x
set -e

PATH_INPUT=src/in.js
PATH_OUTPUT=src/out.js

if [[ $PATH_INPUT -nt $PATH_OUTPUT ]]; then
  babel --compact false ${PATH_INPUT} > ${PATH_OUTPUT}
>
