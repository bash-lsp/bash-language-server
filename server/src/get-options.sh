#!/usr/bin/env bash

# bash-completion can execute the command even when the _longopt fallback below
# is disabled. Reject paths and shell syntax before loading any completions.
if [[ ! "$1" =~ ^[A-Za-z0-9_][A-Za-z0-9_.+-]*$ ]]
then
	exit 1
fi

# Leave the workspace before resolving helper programs or loading completions.
# Use an empty directory so relative PATH entries and project configuration do
# not affect completion, and remove it on both success and failure.
cd / || exit 1
safe_dir="$(mktemp -d "${TMPDIR:-/tmp}/bash-language-server.XXXXXXXXXX")" || exit 1
# Anchor relative TMPDIR paths at / so cleanup still works after changing cwd.
if [[ "$safe_dir" != /* ]]
then
	safe_dir="/$safe_dir"
fi
trap 'rm -rf -- "$safe_dir"' EXIT
cd "$safe_dir" || exit 1

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
