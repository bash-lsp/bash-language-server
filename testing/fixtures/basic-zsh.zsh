#!/usr/bin/env zsh
# Path to your oh-my-zsh installation.
export ZSH=~/.oh-my-zsh

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
DISABLE_UNTRACKED_FILES_DIRTY="true"

fpath=(/usr/local/share/zsh-completions $fpath)

export CLICOLOR=1

echo $DISABLE_UNTRACKED_FILES_DIRTY
