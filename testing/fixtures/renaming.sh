#!/usr/bin/env bash

echo "$_"   # Special variable
echo "$1"   # Positional parameter
1abc="1abc" # Invalidly named variable

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
