#!/usr/bin/env bash

a=14
while :; do
  # doc for function
  random_op() {
    # parsing issue: missing node ")", but is not reported as MISSING
    a=$(((RANDOM % 1000) + 1))
  }
  # issue: hovering does not show documentation for function due to parsing error
  random_op

  sleep 2

  echo $a
done

3
