import { Queue } from 'bullmq';

import { redisConnection } from './redis';

export const documentReminderQueue = new Queue('document-reminder', {
  connection: redisConnection,
});

interface JobRunIO {
  runTask: <T>(taskName: string, callback: () => Promise<T>) => Promise<T>;
  triggerJob: (...args: unknown[]) => Promise<void>;
  wait: (...args: unknown[]) => Promise<void>;
  logger: {
    info(...args: unknown[]): void;
    error(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    log(...args: unknown[]): void;
  };
}

const dummyIO: JobRunIO = {
  runTask: async <T>(taskName: string, fn: () => Promise<T>) => {
    return await fn();
  },
  triggerJob: async (..._args: unknown[]) => {},
  wait: async (..._args: unknown[]) => {},
  logger: {
    info: (..._args: unknown[]) => {},
    error: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    debug: (..._args: unknown[]) => {},
    log: (..._args: unknown[]) => {},
  },
};
