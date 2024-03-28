#!/bin/bash
set -ueo pipefail

if [ -z "$arg" ]; then
echo indent
fi

echo binary&&
echo next line

case "$arg" in
a)
echo case indent
;;
esac

echo space redirects>  /dev/null

function next(){
echo line
}
