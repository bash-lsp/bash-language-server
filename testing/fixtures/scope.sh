#!/usr/bin/env bash

X="Horse"

X="Mouse"

# some function
f() (
  local X="Dog"

  g() {
    local X="Cat"
    echo "${X}"

    # another function function
    f() {
      local X="Bird"
      echo "${X}"
    }

    f
  }

  g

  echo "${X}"
)

echo "${X}"
f
