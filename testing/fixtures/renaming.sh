#!/usr/bin/env bash

# Non-renamable variables

echo "$_"
_="reassigned"
echo "$1"
1abc="1abc"

# Variable and function with the same name

variable_or_function="false"
function variable_or_function {
	echo "$variable_or_function"

	if [[ "$variable_or_function" == "false" ]]; then
		variable_or_function="true"
		variable_or_function
	fi
}

# Undeclared symbols

echo "$HOME"
ls "$HOME"

# Globally scoped declarations

somefunc() { echo "true"; }
somevar="$(ls somedir)"
: "${othervar:="$(ls otherdir)"}"

if [ "$(somefunc)" = "true" ]; then
	echo "$somevar"
	echo "$othervar"
fi

# Function-scoped declarations

function regularFunc() {
	echo "${somevar:="fallback"}"
	somevar="reassigned"

	local a somevar="${somevar:0:8}
		$somevar" b

	somefunc() {
		somevar="reassigned again"
	}
	somefunc

	(
		if [ -n "$somevar" ]; then
			declare a b somevar
			echo $somevar
		fi
	)

	echo "${somevar}"
}

# Subshell-scoped declarations

subshellFunc() (
	echo "${somevar:="fallback"}"
	somevar="${somevar:0:8}
		$somevar"

	local somevar

	(
		somevar="reassigned"
		echo "$somevar"
	)

	function somefunc {
		if [ -z "$somevar" ]; then
			typeset somevar="reassigned" a b
			echo "${somevar}"
		fi
	}
	somefunc

	echo $somevar
)

# Workspace-wide symbols

source ./sourcing.sh

RED="#FF0000"
echo $RED

tagRelease() { echo "reimplemented"; }
tagRelease

# From install.sh
npm_config_loglevel="info"
echo $npm_config_loglevel

# From scope.sh
f() { echo "reimplemented"; }
f

# tree-sitter-bash's parsing limitations with let and arithmetic expressions

for i in 1 2 3; do
	echo "$i"
done

let i=0
for (( ; i < 10; i++)); do
	echo "$((2 * i))"
done

# tree-sitter-bash's parsing limitations with while read loops

while read -r line; do
	echo "$line"
done < somefile.txt

# Complex nesting affects self-assignment handling

f1() {
	local var="var"

	f2() (
		var=$var

		f3() {
			declare var="$var"
		}
	)
}

# Complex scoping affects symbol visibility

callerFunc() (
	localFunc() {
		echo "Hello world"
	}
	calleeFunc
)
calleeFunc() {
	localFunc
}
callerFunc

# Pipeline subshell scope is not recognized

{ pipelinevar="value"; } | { echo $pipelinevar; }

# Sourcing after affects symbols before

echo "$FOO"
. ./issue206.sh

# Sourcing within functions and subshells affects symbols outside

sourcingFunc() { source ./comment-doc-on-hover.sh; }
hello_world "john" "jack"

(. ./missing-node.sh)
echo "$PATH_INPUT"
