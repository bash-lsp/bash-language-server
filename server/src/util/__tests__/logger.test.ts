/* eslint-disable no-console */
import * as LSP from 'vscode-languageserver'

import { getMockConnection } from '../../../../testing/mocks'
import {
  getLogLevelFromEnvironment,
  LOG_LEVEL_ENV_VAR,
  Logger,
  setLogConnection,
  setLogLevel,
} from '../logger'

const mockConnection = getMockConnection()
beforeAll(() => {
  setLogConnection(mockConnection)
  setLogLevel('info')
  jest.useFakeTimers().setSystemTime(1522431328992)
})

jest.spyOn(console, 'warn').mockImplementation(() => {
  // noop
})

describe('Logger', () => {
  it('logs simple message', () => {
    const logger = new Logger()
    logger.info('a test')
    logger.warn('another test')
    expect(mockConnection.sendNotification).toHaveBeenCalledTimes(2)
    expect(mockConnection.sendNotification).toHaveBeenNthCalledWith(
      1,
      LSP.LogMessageNotification.type,
      {
        type: LSP.MessageType.Info,
        message: '17:35:28.992 INFO a test',
      },
    )
    expect(mockConnection.sendNotification).toHaveBeenNthCalledWith(
      2,
      LSP.LogMessageNotification.type,
      {
        type: LSP.MessageType.Warning,
        message: '17:35:28.992 WARNING ⛔️ another test',
      },
    )
  })

  it('allows parsing arguments', () => {
    const logger = new Logger({ prefix: 'myFunc' })
    logger.info('foo', 'bar', 1)
    expect(mockConnection.sendNotification).toHaveBeenCalledTimes(1)
    expect(mockConnection.sendNotification.mock.calls[0][1]).toEqual({
      type: LSP.MessageType.Info,
      message: '17:35:28.992 INFO myFunc - foo bar 1',
    })
  })

  it('allows parsing arguments with objects', () => {
    const logger = new Logger({ prefix: 'myFunc' })
    logger.error('foo', { bar: 1 })
    expect(mockConnection.sendNotification).toHaveBeenCalledTimes(1)
    expect(mockConnection.sendNotification.mock.calls[0][1]).toEqual({
      type: LSP.MessageType.Error,
      message: '17:35:28.992 ERROR ⛔️ myFunc - foo {\n' + '  "bar": 1\n' + '}',
    })
  })

  it('handles Error', () => {
    const logger = new Logger()
    logger.error('msg', new Error('boom'))
    expect(mockConnection.sendNotification).toHaveBeenCalledTimes(1)
    expect(mockConnection.sendNotification.mock.calls[0][1]).toEqual({
      type: LSP.MessageType.Error,
      message: expect.stringContaining('17:35:28.992 ERROR ⛔️ msg Error: boom'),
    })
  })
})

describe('getLogLevelFromEnvironment', () => {
  it('returns default log level if no environment variable is set', () => {
    expect(getLogLevelFromEnvironment()).toEqual(LSP.MessageType.Info)
  })

  it('returns default log level if environment variable is set to an invalid value', () => {
    process.env[LOG_LEVEL_ENV_VAR] = 'invalid'
    expect(getLogLevelFromEnvironment()).toEqual(LSP.MessageType.Info)

    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith(
      `Invalid BASH_IDE_LOG_LEVEL "invalid", expected one of: debug, info, warning, error`,
    )
  })

  it('returns log level from environment variable', () => {
    process.env[LOG_LEVEL_ENV_VAR] = 'debug'
    expect(getLogLevelFromEnvironment()).toEqual(LSP.MessageType.Log)
  })
})
