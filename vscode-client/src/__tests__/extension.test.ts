import { ExtensionContext } from 'vscode'

import { activate } from '../extension'

jest.mock('vscode')

function getContextMock(): jest.Mocked<ExtensionContext> {
  return {
    subscriptions: [],
    workspaceState: {
      get: jest.fn(),
      update: jest.fn(),
    },
    globalState: {
      get: jest.fn(),
      update: jest.fn(),
    },
    extensionPath: '/extensionPath',
    asAbsolutePath: jest.fn(path => `/abs/${path}`),
    storagePath: undefined,
    logPath: '/logpath',
  }
}

describe('extension', () => {
  it('...', async () => {
    const contextMock = getContextMock()
    await activate(contextMock)

    expect(contextMock.asAbsolutePath).toHaveBeenCalledWith('?')
    expect(contextMock.subscriptions).toEqual(['?'])
  })
})
