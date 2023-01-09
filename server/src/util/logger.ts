import * as LSP from 'vscode-languageserver'

export const LOG_LEVEL_ENV_VAR = 'BASH_IDE_LOG_LEVEL'

// Singleton madness to allow for logging from anywhere in the codebase
let _connection: LSP.Connection | null = null
let _logLevel: LSP.MessageType = getLogLevelFromEnvironment()

/**
 * Set the log connection. Should be done at startup.
 */
export function setLogConnection(connection: LSP.Connection) {
  _connection = connection
}

/**
 * Set the minimum log level.
 */
export function setLogLevel(logLevel: LSP.MessageType) {
  _logLevel = logLevel
}

export class Logger {
  private prefix: string

  constructor({ prefix = '' }: { prefix?: string } = {}) {
    this.prefix = prefix
  }

  static MESSAGE_TYPE_TO_LOG_LEVEL_MSG: Record<LSP.MessageType, string> = {
    [LSP.MessageType.Error]: 'ERROR ⛔️',
    [LSP.MessageType.Warning]: 'WARNING ⛔️',
    [LSP.MessageType.Info]: 'INFO',
    [LSP.MessageType.Log]: 'DEBUG',
  }

  public log(severity: LSP.MessageType, messageObjects: any[]) {
    if (_logLevel < severity) {
      return
    }

    if (!_connection) {
      // eslint-disable-next-line no-console
      console.warn(`The logger's LSP Connection is not set. Dropping messages`)
      return
    }

    const formattedMessage = messageObjects
      .map((p) => {
        if (p instanceof Error) {
          return p.stack || p.message
        }

        if (typeof p === 'object') {
          return JSON.stringify(p, null, 2)
        }

        return p
      })
      .join(' ')

    const level = Logger.MESSAGE_TYPE_TO_LOG_LEVEL_MSG[severity]
    const prefix = this.prefix ? `${this.prefix} - ` : ''
    const time = new Date().toISOString().substring(11, 23)
    const message = `${time} ${level} ${prefix}${formattedMessage}`

    _connection.sendNotification(LSP.LogMessageNotification.type, {
      type: severity,
      message,
    })
  }

  public debug(message: string, ...additionalArgs: any[]) {
    this.log(LSP.MessageType.Log, [message, ...additionalArgs])
  }
  public info(message: string, ...additionalArgs: any[]) {
    this.log(LSP.MessageType.Info, [message, ...additionalArgs])
  }
  public warn(message: string, ...additionalArgs: any[]) {
    this.log(LSP.MessageType.Warning, [message, ...additionalArgs])
  }
  public error(message: string, ...additionalArgs: any[]) {
    this.log(LSP.MessageType.Error, [message, ...additionalArgs])
  }
}

export const logger = new Logger()

/**
 * Get the log level from the environment.
 * Note that this is not part of the server/config.ts as this needs to be provided when
 * the server starts.
 */
export function getLogLevelFromEnvironment(): LSP.MessageType {
  const ENV_LOG_LEVELS_TO_MESSAGE_TYPES: Record<string, LSP.MessageType | undefined> = {
    DEBUG: LSP.MessageType.Log,
    INFO: LSP.MessageType.Info,
    WARNING: LSP.MessageType.Warning,
    ERROR: LSP.MessageType.Error,
  }

  const logLevelFromEnvironment = process.env[LOG_LEVEL_ENV_VAR]
  if (logLevelFromEnvironment) {
    const logLevel = ENV_LOG_LEVELS_TO_MESSAGE_TYPES[logLevelFromEnvironment]
    if (logLevel) {
      return logLevel
    }
    // eslint-disable-next-line no-console
    console.warn(
      `Invalid ${LOG_LEVEL_ENV_VAR} "${logLevelFromEnvironment}", expected one of: ${Object.keys(
        ENV_LOG_LEVELS_TO_MESSAGE_TYPES,
      ).join(', ')}`,
    )
  }

  return LSP.MessageType.Info
}
