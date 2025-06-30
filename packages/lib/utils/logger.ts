import { type TransportTargetOptions, pino } from 'pino';

import { env } from './env';

const transports: TransportTargetOptions[] = [];

if (env('NODE_ENV') !== 'production' && !env('INTERNAL_FORCE_JSON_LOGGER')) {
  transports.push({
    target: 'pino-pretty',
    level: 'info',
  });
}

const loggingFilePath = env('NEXT_PRIVATE_LOGGER_FILE_PATH');

if (loggingFilePath) {
  transports.push({
    target: 'pino/file',
    level: 'info',
    options: {
      destination: loggingFilePath,
      mkdir: true,
    },
  });
}

export const logger = pino({
  level: 'info',
  transport:
    transports.length > 0
      ? {
          targets: transports,
        }
      : undefined,
});
