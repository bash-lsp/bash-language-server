#!/usr/bin/env bats

load test_helper

setup() {
  setup_test_env
}

@test "it works" {
  run true
  [ "$status" -eq 0 ]
}
