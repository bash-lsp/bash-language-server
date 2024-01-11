#!/bin/env ksh
# this shebang must be overriden by shell directive
   # this line must be ignored

	 #  shellcheck disable=SC1072 shell=sh  enable=require-variable-braces


if [[ -n "$TERM" ]]; then
	echo "$TERM"
fi

# shellcheck shell=dash
