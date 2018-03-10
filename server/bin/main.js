#!/usr/bin/env node

const server = require('../out/index')
const package = require('../package')

const args = process.argv

const start = args.find(s => s == 'start')
const version = args.find(s => s == '-v' || s == '--version')
const help = args.find(s => s == '-h' || s == '--help')

if (start) {
  server.listen()
} else if (version) {
  console.log(`Version is ${package.version}`)
} else if (help) {
  console.log(`
Usage:
  bash-language-server start
  bash-language-server -h | --help
  bash-language-server -v | --version
  `)
} else {
  const command = args.join(' ')
  console.error(`Unknown command '${command}'. Run with -h for help.`)
}
