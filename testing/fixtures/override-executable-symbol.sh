#!/usr/bin/env bash

ls

# override documentation for `ls` symbol
ls() {
  echo "Overridden"
}

ls
