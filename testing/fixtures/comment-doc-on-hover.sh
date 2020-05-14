#!/usr/bin/env bash


# this is a comment
# describing the function
# hello_world
# this function takes two arguments
hello_world() {
    echo "hello world to: $1 and $2"
}



# if the user hovers above the below hello_world invocation
# they should see the comment doc string in a tooltip
# containing the lines 4 - 7 above

hello_world "bob" "sally"
