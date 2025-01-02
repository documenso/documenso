import Honeybadger from '@honeybadger-io/js';

import { env } from './env';

export const buildLogger = () => {
  if (env('NEXT_PRIVATE_LOGGER_HONEY_BADGER_API_KEY')) {
    return new HoneybadgerLogger();
  }

  return new DefaultLogger();
};

interface LoggerDescriptionOptions {
  method?: string;
  path?: string;
  context?: Record<string, unknown>;

  /**
   * The type of log to be captured.
   *
   * Defaults to `info`.
   */
  level?: 'info' | 'error' | 'critical';
}

/**
 * Basic logger implementation intended to be used in the server side for capturing
 * explicit errors and other logs.
 *
 * Not intended to capture the request and responses.
 */
interface Logger {
  log(message: string, options?: LoggerDescriptionOptions): void;

  error(error: Error, options?: LoggerDescriptionOptions): void;
}

class DefaultLogger implements Logger {
  log(_message: string, _options?: LoggerDescriptionOptions) {
    // Do nothing.
  }

  error(_error: Error, _options?: LoggerDescriptionOptions): void {
    // Do nothing.
  }
}

class HoneybadgerLogger implements Logger {
  constructor() {
    if (!env('NEXT_PRIVATE_LOGGER_HONEY_BADGER_API_KEY')) {
      throw new Error('NEXT_PRIVATE_LOGGER_HONEY_BADGER_API_KEY is not set');
    }

    Honeybadger.configure({
      apiKey: env('NEXT_PRIVATE_LOGGER_HONEY_BADGER_API_KEY'),
    });
  }

  /**
   * Honeybadger doesn't really have a non-error logging system.
   */
  log(message: string, options?: LoggerDescriptionOptions) {
    const { context = {}, level = 'info' } = options || {};

    try {
      Honeybadger.event({
        message,
        context: {
          level,
          ...context,
        },
      });
    } catch (err) {
      console.error(err);

      // Do nothing.
    }
  }

  error(error: Error, options?: LoggerDescriptionOptions): void {
    const { context = {}, level = 'error', method, path } = options || {};

    // const tags = [`level:${level}`];
    const tags = [];

    let errorMessage = error.message;

    if (method) {
      tags.push(`method:${method}`);

      errorMessage = `[${method}]: ${error.message}`;
    }

    if (path) {
      tags.push(`path:${path}`);
    }

    try {
      Honeybadger.notify(errorMessage, {
        context: {
          level,
          ...context,
        },
        tags,
      });
    } catch (err) {
      console.error(err);

      // Do nothing.
    }
  }
}
