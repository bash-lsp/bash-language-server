#!/usr/bin/env bash

X="Horse"

X="Mouse"

# some function
f() (
  local X="Dog"
  GLOBAL_1="Global 1"

  g() {
    local X="Cat"
    GLOBAL_1="Global 1"
    GLOBAL_2="Global 1"
    echo "${X}"

    # another function function
    f() {
      local X="Bird"
      echo "${X}"
    }

    f
  }

  g

  echo "${GLOBAL_1}"
  echo "${X}"
)

echo "${X}"
f

echo "${GLOBAL_2}"

for i in 1 2 3 4 5
do
 echo "$GLOBAL_1 $i"
done

echo "$npm_config_loglevel" # this is an undefined variable, but defined in install.sh
