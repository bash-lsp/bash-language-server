#!/usr/bin/env bash

# Try and get COMPLETIONSRC using pkg-config
COMPLETIONSDIR="$(pkg-config --variable=completionsdir bash-completion)"

if (( $? == 0 ))
then
	COMPLETIONSRC="$(dirname "$COMPLETIONSDIR")/bash_completion"
else
	# Fallback if pkg-config fails
	if [ "$(uname -s)" = "Darwin" ]
	then
		# Running macOS
		COMPLETIONSRC="$(brew --prefix)/etc/bash_completion"
	else
		# Suppose running Linux
		COMPLETIONSRC="${PREFIX:-/usr}/share/bash-completion/bash_completion"
	fi
fi

# Validate path of COMPLETIONSRC
if (( $? != 0 )) || [ ! -r "$COMPLETIONSRC" ]
then
	exit 1
fi

source "$COMPLETIONSRC"

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
