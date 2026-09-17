import fs from 'fs'

import { initializeParser } from '../../parser'
import { getSourceCommands } from '../sourcing'

it.each([
  '"${PROJECT_DIR}/libs/lib.sh"',
  '"$PROJECT_DIR/libs/lib.sh"',
  '"${PROJECT_DIR}/libs"/lib.sh',
  '"$PROJECT_DIR"/libs/lib.sh',
])('resolves a leading dynamic directory with a static suffix: %s', async (argument) => {
  const parser = await initializeParser()
  const exists = jest
    .spyOn(fs, 'existsSync')
    .mockImplementation((filePath) => filePath === '/project/libs/lib.sh')
  try {
    const sources = getSourceCommands({
      fileUri: 'file:///project/main.sh',
      rootPath: '/project',
      tree: parser.parse(`PROJECT_DIR="/project"\nsource ${argument}\nhello`)!,
    })
    expect(sources.map(({ uri, error }) => ({ uri, error }))).toEqual([
      { uri: 'file:///project/libs/lib.sh', error: null },
    ])
  } finally {
    exists.mockRestore()
  }
})

it.each([
  '"${PROJECT_DIR}/${OTHER}/lib.sh"',
  '"${PROJECT_DIR}/libs"/$OTHER',
  '"prefix${PROJECT_DIR}/libs/lib.sh"',
  '"$(pwd)/libs/lib.sh"',
])('does not guess a path with additional dynamic content: %s', async (argument) => {
  const parser = await initializeParser()
  const sources = getSourceCommands({
    fileUri: 'file:///project/main.sh',
    rootPath: '/project',
    tree: parser.parse(`source ${argument}`)!,
  })
  expect(sources[0].uri).toBeNull()
  expect(sources[0].error).toBe('non-constant source not supported')
})
