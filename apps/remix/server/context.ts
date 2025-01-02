import type { Context, Next } from 'hono';

import { extractSessionCookieFromHeaders } from '@documenso/auth/server/lib/session/session-cookies';
import {
  type RequestMetadata,
  extractRequestMetadata,
} from '@documenso/lib/universal/extract-request-metadata';

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
  const url = new URL(request.url);

  const noSessionCookie = extractSessionCookieFromHeaders(request.headers) === null;

  setAppContext(c, {
    requestMetadata: extractRequestMetadata(request),
  });

  // These are non page paths like API.
  if (!isPageRequest(request) || noSessionCookie || blacklistedPathsRegex.test(url.pathname)) {
    return next();
  }

  // Add context to any pages you want here.

  return next();
};

const setAppContext = (c: Context, context: AppContext) => {
  c.set('context', context);
};

const isPageRequest = (request: Request) => {
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return false;
  }

  // If it ends with .data it's the loader which we need to pass context for.
  if (url.pathname.endsWith('.data')) {
    return true;
  }

  if (request.headers.get('Accept')?.includes('text/html')) {
    return true;
  }

  return false;
};

/**
 * List of paths to reject
 * - Urls that start with /api
 * - Urls that start with _
 */
const blacklistedPathsRegex = new RegExp('^/api/|^/__');
