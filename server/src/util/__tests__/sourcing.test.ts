import * as fs from 'fs'
import * as os from 'os'
import * as Parser from 'web-tree-sitter'

import { REPO_ROOT_FOLDER } from '../../../../testing/fixtures'
import { initializeParser } from '../../parser'
import { getSourceCommands } from '../sourcing'

const fileDirectory = '/Users/bash'
const fileUri = `${fileDirectory}/file.sh`

let parser: Parser
beforeAll(async () => {
  parser = await initializeParser()
})

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

  it('returns a set of sourced files (but ignores some unhandled cases)', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)

    const fileContent = `
      source file-in-path.sh # does not contain a slash (i.e. is maybe somewhere on the path)

      source '/bin/extension.inc' # absolute path

      source ./x a b c # some arguments

      . ../scripts/release-client.sh

      source ~/myscript

      # source ...

      source "$LIBPATH" # dynamic imports not supported

      source "$SCRIPT_DIR"/issue-926.sh # remove leading dynamic segment

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

      # ======================================
      # Example of sourcing through a function
      # ======================================

      loadlib () {
        source "$1.sh"
      }

      loadlib "issue101"

      # ======================================
      # Example of dynamic sourcing
      # ======================================

      SCRIPT_DIR=$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )
      case "$ENV" in
      staging)
        source "$SCRIPT_DIR"/staging.sh
        ;;
      production)
        source "$SCRIPT_DIR"/production.sh
        ;;
      *)
        echo "Unknown environment please use 'staging' or 'production'"
        exit 1
        ;;
      esac

      # ======================================
      # Example of sourcing through a loop
      # ======================================

      # Only set $BASH_IT if it's not already set
      if [ -z "$BASH_IT" ];
      then
          # Setting $BASH to maintain backwards compatibility
          # TODO: warn users that they should upgrade their .bash_profile
          export BASH_IT=$BASH
          export BASH="$(bash -c 'echo $BASH')"
      fi

      # Load custom aliases, completion, plugins
      for file_type in "aliases" "completion" "plugins"
      do
        if [ -e "\${BASH_IT}/\${file_type}/custom.\${file_type}.bash" ]
        then
          # shellcheck disable=SC1090
          source "\${BASH_IT}/\${file_type}/custom.\${file_type}.bash"
        fi
      done
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
        "file:///Users/bash/issue-926.sh",
        "file:///Users/bash/issue206.sh",
        "file:///Users/bash/staging.sh",
        "file:///Users/bash/production.sh",
      }
    `)

    expect(sourceCommands).toMatchSnapshot()
  })

  it('returns a set of sourced files and parses ShellCheck directives', () => {
    jest.restoreAllMocks()

    const fileContent = `
      . ./scripts/release-client.sh

      source ./testing/fixtures/issue206.sh

      # shellcheck source=/dev/null
      source ./IM_NOT_THERE.sh

      # shellcheck source-path=testing/fixtures
      source missing-node.sh # source path by directive

      # shellcheck source=./testing/fixtures/install.sh
      source "$X" # source by directive

      # shellcheck source=./some-file-that-does-not-exist.sh
      source "$Y" # not source due to invalid directive

      # shellcheck source-path=SCRIPTDIR # note that this is already the behaviour of bash language server
      source ./testing/fixtures/issue101.sh

      source # not finished
      `

    const sourceCommands = getSourceCommands({
      fileUri,
      rootPath: REPO_ROOT_FOLDER,
      tree: parser.parse(fileContent),
    })

    const sourcedUris = new Set(
      sourceCommands
        .map((sourceCommand) => sourceCommand.uri)
        .filter((uri) => uri !== null),
    )

    expect(sourcedUris).toEqual(
      new Set([
        `file://${REPO_ROOT_FOLDER}/scripts/release-client.sh`,
        `file://${REPO_ROOT_FOLDER}/testing/fixtures/issue206.sh`,
        `file://${REPO_ROOT_FOLDER}/testing/fixtures/missing-node.sh`,
        `file://${REPO_ROOT_FOLDER}/testing/fixtures/install.sh`,
        `file://${REPO_ROOT_FOLDER}/testing/fixtures/issue101.sh`,
      ]),
    )

    expect(
      sourceCommands
        .filter((command) => command.error)
        .map(({ error, range }) => ({
          error,
          line: range.start.line,
        })),
    ).toMatchInlineSnapshot(`
      [
        {
          "error": "failed to resolve path",
          "line": 15,
        },
      ]
    `)
  })
})
