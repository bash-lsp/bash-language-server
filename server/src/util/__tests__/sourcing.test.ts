import * as fs from 'fs'
import * as os from 'os'
import * as Parser from 'web-tree-sitter'

import { initializeParser } from '../../parser'
import { getSourceCommands } from '../sourcing'

const fileDirectory = '/Users/bash'
const fileUri = `${fileDirectory}/file.sh`

let parser: Parser
beforeAll(async () => {
  parser = await initializeParser()
})

jest.spyOn(fs, 'existsSync').mockImplementation(() => true)

// mock os.homedir() to return a fixed path
jest.spyOn(os, 'homedir').mockImplementation(() => '/Users/bash-user')

describe('getSourcedUris', () => {
  it('returns an empty set if no files were sourced', () => {
    const fileContent = ''
    const sourceCommands = getSourceCommands({
      fileUri,
      rootPath: null,
      tree: parser.parse(fileContent),
    })
    expect(sourceCommands).toEqual([])
  })

  it('returns a set of sourced files', () => {
    const fileContent = `
      source file-in-path.sh # does not contain a slash (i.e. is maybe somewhere on the path)

      source /bin/extension.inc # absolute path

      source ./x a b c # some arguments

      . ../scripts/release-client.sh

      source ~/myscript

      # source ...

      source "$LIBPATH" # dynamic imports not supported

      # conditional is currently not supported
      if [[ -z $__COMPLETION_LIB_LOADED ]]; then source "$LIBPATH" ; fi

      . "$BASH_IT/themes/$BASH_IT_THEME/$BASH_IT_THEME.theme.bash"

      show ()
      {
        about 'Shows SVN proxy settings'
        group 'proxy'

        source "./issue206.sh" # quoted file in fixtures folder

        echo "SVN Proxy Settings"
        echo "=================="
        python2 - <<END
      import ConfigParser
      source ./this-should-be-ignored.sh
      END
      }

      cat $f | python -c '
      import sys
      source also-ignore.sh
      ' | sort > $counts_file
        fi
      done

      loadlib () {
        source "$1.sh"
      }

      loadlib "issue101"
    `

    const sourceCommands = getSourceCommands({
      fileUri,
      rootPath: null,
      tree: parser.parse(fileContent),
    })

    const sourcedUris = new Set(
      sourceCommands
        .map((sourceCommand) => sourceCommand.uri)
        .filter((uri) => uri !== null),
    )

    expect(sourcedUris).toMatchInlineSnapshot(`
      Set {
        "file:///Users/bash/file-in-path.sh",
        "file:///bin/extension.inc",
        "file:///Users/bash/x",
        "file:///Users/scripts/release-client.sh",
        "file:///Users/bash-user/myscript",
        "file:///Users/bash/issue206.sh",
      }
    `)

    expect(sourceCommands).toMatchSnapshot()
  })
})
