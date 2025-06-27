import { pino } from 'pino';

// const transports: TransportTargetOptions[] = [];

// if (env('NEXT_PRIVATE_LOGGING_DEV')) {
// transports.push({
//   target: 'pino-pretty',
//   level: 'info',
// });
// }

// const loggingFilePath = env('NEXT_PRIVATE_LOGGING_FILE_PATH');

// if (loggingFilePath) {
//   transports.push({
//     target: 'pino/file',
//     level: 'info',
//     options: {
//       destination: loggingFilePath,
//       mkdir: true,
//     },
//   });
// }

export const logger = pino({
  level: 'info',
});
