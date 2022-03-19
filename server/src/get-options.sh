#!/usr/bin/env bash

COMPLETIONSDIR="$(pkg-config --variable=completionsdir bash-completion)"
DATADIR="$(dirname "$(dirname "${COMPLETIONSDIR}")")"

# Exit if bash-completion isn't installed.
if (( $? != 0 ))
then
	exit 1
fi

source "$DATADIR/bash-completion/bash_completion"

COMP_LINE="$*"
COMP_WORDS=("$@")
COMP_CWORD="${#COMP_WORDS[@]}"
((COMP_CWORD--))
COMP_POINT="${#COMP_LINE}"
COMP_WORDBREAKS='"'"'><=;|&(:"

_command_offset 0 2> /dev/null

if (( ${#COMPREPLY[@]} == 0 ))
then
	# Disabled by default because _longopt executes the program
	# to get its options.
	if (( ${BASH_LSP_COMPLETE_LONGOPTS} == 1 ))
	then
		_longopt "${COMP_WORDS[0]}"
	fi
fi

printf "%s\t" "${COMPREPLY[@]}"
