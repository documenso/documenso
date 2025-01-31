import { env } from '@documenso/lib/utils/env';

// Todo: Delete
export const authDebugger = (message: string) => {
  if (env('NODE_ENV') === 'development') {
    // console.log(`[DEBUG]: ${message}`);
  }
};
