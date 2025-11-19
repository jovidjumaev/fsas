/**
 * Logger utility for backend (Node.js)
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = process.env.DEBUG === 'true';

class Logger {
  constructor(module = 'Backend') {
    this.module = module;
  }

  shouldLog(level, force) {
    if (force) return true;
    if (!isDevelopment) return false;
    if (level === 'debug' && !isDebugEnabled) return false;
    return true;
  }

  formatMessage(message) {
    return `[${this.module}] ${message}`;
  }

  log(message, ...args) {
    if (this.shouldLog('log')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message, error, options = {}) {
    if (this.shouldLog('error', options.force)) {
      console.error(this.formatMessage(message), error);
    }
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  group(label) {
    if (this.shouldLog('log')) {
      console.group(this.formatMessage(label));
    }
  }

  groupEnd() {
    if (this.shouldLog('log')) {
      console.groupEnd();
    }
  }

  time(label) {
    if (this.shouldLog('log')) {
      console.time(this.formatMessage(label));
    }
  }

  timeEnd(label) {
    if (this.shouldLog('log')) {
      console.timeEnd(this.formatMessage(label));
    }
  }

  table(data) {
    if (this.shouldLog('log')) {
      console.table(data);
    }
  }
}

function createLogger(module) {
  return new Logger(module);
}

module.exports = {
  Logger,
  createLogger,
  logger: new Logger()
};
