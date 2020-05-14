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



# doc for func_one
func_one() {
    echo "func_one"
}

# doc for func_two
# has two lines
func_two() {
    echo "func_two"
}


# this is not included

# doc for func_three
func_three() {
    echo "func_three"
}


# works for variables
my_var="pizza"


my_other_var="no comments above me :("

