import log, { type LogLevelDesc } from 'loglevel'

function readStoredLogLevel(): LogLevelDesc | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null
    }
    const storedLevel = window.localStorage.getItem('logLevel')
    if (storedLevel) {
      const normalized = storedLevel.toUpperCase()
      if (normalized in log.levels) {
        return normalized.toLowerCase() as LogLevelDesc
      }
    }
  } catch {
    /* ignore storage access issues */
  }
  return null
}

const defaultLevel: LogLevelDesc = import.meta.env && import.meta.env.PROD ? 'warn' : 'debug'

const initialLevel = readStoredLogLevel() ?? defaultLevel
log.setLevel(initialLevel)

// Optional: Add custom formatting for better readability
const originalFactory = log.methodFactory
log.methodFactory = function (methodName, logLevel, loggerName) {
  const rawMethod = originalFactory(methodName, logLevel, loggerName)

  return function (...args) {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${methodName.toUpperCase()}]`
    rawMethod(prefix, ...args)
  }
}

// Apply the custom method factory
log.setLevel(log.getLevel())

// Create logger instances for different parts of your app
export const createLogger = (namespace: string) => {
  return {
    trace: (...args: any[]) => log.trace(`[${namespace}]`, ...args),
    debug: (...args: any[]) => log.debug(`[${namespace}]`, ...args),
    info: (...args: any[]) => log.info(`[${namespace}]`, ...args),
    warn: (...args: any[]) => log.warn(`[${namespace}]`, ...args),
    error: (...args: any[]) => log.error(`[${namespace}]`, ...args)
  }
}

// Export default logger
export default log
