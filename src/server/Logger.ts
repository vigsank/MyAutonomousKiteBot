import pino from 'pino';

/**
 * Structured JSON logger powered by pino — the fastest Node.js logger.
 *
 * In development (NODE_ENV != 'production') output is pretty-printed with
 * colours via pino-pretty. In production it emits newline-delimited JSON
 * for ingestion by log aggregators.
 *
 * Log level is controlled by LOG_LEVEL env var (trace/debug/info/warn/error/fatal).
 * Defaults to 'info'.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
  base: { pid: process.pid },
  timestamp: pino.stdTimeFunctions.isoTime,
});
