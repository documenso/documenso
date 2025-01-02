import { env } from './env';

/**
 * Which areas to debug, keyed by context.
 */
const debugging: Record<string, boolean> = {
  auth: env('NEXT_DEBUG_AUTH') === 'true',
  job: env('NEXT_DEBUG_JOB') === 'true',
  middleware: env('NEXT_DEBUG_MIDDLEWARE') === 'true',
};

export const appLog = (context: string, ...args: Parameters<typeof console.log>) => {
  if (debugging[context.toLowerCase()] === false) {
    return;
  }

  if (env('NEXT_DEBUG') === 'true') {
    console.log(`[${context}]: ${args[0]}`, ...args.slice(1));
  }
};

export class AppDebugger {
  public context: string;

  constructor(context: string) {
    this.context = context;
  }

  public log(...args: Parameters<typeof console.log>) {
    appLog(this.context, ...args);
  }
}
