#!/usr/bin/env bash

# Special variables
echo "$_"
_="reassign"
# Positional parameters
echo "$1"
2="reassign"
# Invalidly named variables
1abc="1abc"
ab%c="ab%c"

somevar="$(ls somedir)"
somecommand() {
	echo "true"
}

if [ "$(somecommand)" == "true" ]; then
	echo "$somevar"
fi

for i in 1 2 3; do
	echo "$i"
done

for ((i = 0; i < 10; i++)); do
	echo "$((i * 2))"
done
