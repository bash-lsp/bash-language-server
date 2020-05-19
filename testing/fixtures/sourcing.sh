#!/bin/sh

source ./extension.inc

echo $RED 'Hello in red!'

echo $BLU

add_a_us

BOLD=`tput bold` # redefined

echo $BOL

echo "$"
