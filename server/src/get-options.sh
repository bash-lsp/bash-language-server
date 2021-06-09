#!/usr/bin/env bash

source /usr/share/bash-completion/bash_completion

COMP_LINE="$*"
COMP_WORDS=("$@")
COMP_CWORD="${#COMP_WORDS[@]}"
((COMP_CWORD--))
COMP_POINT="${#COMP_LINE}"
COMP_WORDBREAKS='"'"'><=;|&(:"

_command_offset 0 2> /dev/null

if (( ${#COMPREPLY[@]} == 0 ))
then
	_longopt "${COMP_WORDS[0]}"
fi

printf "%s\t" "${COMPREPLY[@]}"
