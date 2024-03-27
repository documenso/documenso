import type { LoggerConfig } from 'next-axiom';
import { Logger } from 'next-axiom';

/**
 * For usage in server-side code.
 *
 * When used in a server component, you must flush the logs.
 *
 * https://github.com/axiomhq/next-axiom?tab=readme-ov-file#server-components
 */
export const buildServerLogger = (config?: LoggerConfig) => {
  return new Logger({
    source: 'server',
    ...config,
  });
};
