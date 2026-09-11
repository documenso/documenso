import { extractRequestMetadata, type RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { Context, Next } from 'hono';

export type AppContext = {
  requestMetadata: RequestMetadata;
};

/**
 * Apply a context which can be accessed throughout the app.
 *
 * Keep this as lean as possible in terms of awaiting, because anything
 * here will increase each page load time.
 */
export const appContext = async (c: Context, next: Next) => {
  const request = c.req.raw;
  setAppContext(c, {
    requestMetadata: extractRequestMetadata(request),
  });

  return next();
};

const setAppContext = (c: Context, context: AppContext) => {
  c.set('context', context);
};
