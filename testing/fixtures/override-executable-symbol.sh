#!/usr/bin/env bash

ls -la

# override documentation for `ls` symbol
ls() {
  echo "Overridden"
}

ls
