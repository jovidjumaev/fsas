/**
 * Logger utility that only logs in development mode
 * This prevents console statements from running in production,
 * improving performance and reducing bundle size
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG === 'true';

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LoggerOptions {
  module?: string;
  force?: boolean; // Force logging even in production (for critical errors)
}

class Logger {
  private module: string;

  constructor(module: string = 'App') {
    this.module = module;
  }

  private shouldLog(level: LogLevel, force?: boolean): boolean {
    if (force) return true;
    if (!isDevelopment) return false;
    if (level === 'debug' && !isDebugEnabled) return false;
    return true;
  }

  private formatMessage(message: string): string {
    return `[${this.module}] ${message}`;
  }

  log(message: string, ...args: any[]): void {
    if (this.shouldLog('log')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, error?: any, options?: LoggerOptions): void {
    // Errors are more important, so we might want to force them in production
    if (this.shouldLog('error', options?.force)) {
      console.error(this.formatMessage(message), error);

      // In production, you might want to send errors to a monitoring service
      if (!isDevelopment && options?.force) {
        // TODO: Send to error tracking service (e.g., Sentry)
        // this.sendToErrorTracking(message, error);
      }
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  group(label: string): void {
    if (this.shouldLog('log')) {
      console.group(this.formatMessage(label));
    }
  }

  groupEnd(): void {
    if (this.shouldLog('log')) {
      console.groupEnd();
    }
  }

  time(label: string): void {
    if (this.shouldLog('log')) {
      console.time(this.formatMessage(label));
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog('log')) {
      console.timeEnd(this.formatMessage(label));
    }
  }

  table(data: any): void {
    if (this.shouldLog('log')) {
      console.table(data);
    }
  }
}

// Factory function to create logger instances for different modules
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// Default logger instance
export const logger = new Logger();

// Convenience exports for different modules
export const authLogger = createLogger('Auth');
export const apiLogger = createLogger('API');
export const dbLogger = createLogger('Database');
export const uiLogger = createLogger('UI');

// Export the Logger class for custom instances
export default Logger;