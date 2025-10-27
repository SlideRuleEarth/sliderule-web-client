import log from 'loglevel';

// Configure log level based on environment
// Check if import.meta.env exists (Vite context) before accessing it
if (import.meta.env && import.meta.env.PROD) {
  // In production, only show warnings and errors
  log.setLevel('warn');
} else {
  // In development/test, show all logs including debug
  log.setLevel('debug');
}

// Optional: Add custom formatting for better readability
const originalFactory = log.methodFactory;
log.methodFactory = function (methodName, logLevel, loggerName) {
  const rawMethod = originalFactory(methodName, logLevel, loggerName);

  return function (...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${methodName.toUpperCase()}]`;
    rawMethod(prefix, ...args);
  };
};

// Apply the custom method factory
log.setLevel(log.getLevel());

// Create logger instances for different parts of your app
export const createLogger = (namespace: string) => {
  return {
    trace: (...args: any[]) => log.trace(`[${namespace}]`, ...args),
    debug: (...args: any[]) => log.debug(`[${namespace}]`, ...args),
    info: (...args: any[]) => log.info(`[${namespace}]`, ...args),
    warn: (...args: any[]) => log.warn(`[${namespace}]`, ...args),
    error: (...args: any[]) => log.error(`[${namespace}]`, ...args),
  };
};

// Export default logger
export default log;
