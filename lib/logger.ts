import winston from 'winston'
import { LOG_LEVEL } from '../bot.config'

const g = globalThis as { _logger?: winston.Logger }

function createLogger(): winston.Logger {
  return winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
        return `${timestamp} [${level}] ${message}${metaStr}`
      })
    ),
    transports: [
      new winston.transports.Console(),
    ],
  })
}

export const logger: winston.Logger = g._logger ?? createLogger()
if (!g._logger) g._logger = logger
