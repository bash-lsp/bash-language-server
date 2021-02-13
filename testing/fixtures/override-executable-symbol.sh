#!/usr/bin/env bash

# override documentation for `ls` symbol
ls() {
  echo "Overridden"
}

ls
