// Origin: https://raw.githubusercontent.com/rubyide/vscode-ruby

import * as path from 'path'
import * as prebuildInstall from 'prebuild-install'

export enum NodeRuntime {
  Electron = 1,
  Node = 2,
}

function packageToGithubRepository(name: string): string {
  switch (name) {
    case 'tree-sitter':
      return 'node-tree-sitter'
    default:
      return name
  }
}

function downloadUrl({
  name,
  version,
  nodeRuntime,
}: {
  name: string
  version: string
  nodeRuntime: NodeRuntime
}): string {
  const repo: string = packageToGithubRepository(name)
  const urlBase: string = `https://github.com/tree-sitter/${repo}/releases/download/v${version}/`
  const prebuildPackage: string = `${name}-v${version}-${
    nodeRuntime === NodeRuntime.Electron ? 'electron' : 'node'
  }-v${process.versions.modules}-${process.platform}-${process.arch}.tar.gz`

  return `${urlBase}${prebuildPackage}`
}

function fetchPrebuild(name: string, nodeRuntime: NodeRuntime): Promise<void | Error> {
  const pkgRoot: string = path.resolve(path.join(__dirname, '../../node_modules', name))
  const pkg: { name: string; version: string } = require(`${pkgRoot}/package.json`)
  const url: string = downloadUrl({ name: pkg.name, version: pkg.version, nodeRuntime })

  return new Promise((resolve, reject) => {
    prebuildInstall.download(url, { pkg, path: pkgRoot }, (err: Error) => {
      err ? reject(err) : resolve()
    })
  })
}

export function rebuildTreeSitter(
  nodeRuntime: NodeRuntime
): Promise<[void | Error, void | Error]> {
  return Promise.all([
    fetchPrebuild('tree-sitter', nodeRuntime),
    fetchPrebuild('tree-sitter-bash', nodeRuntime),
  ])
}
