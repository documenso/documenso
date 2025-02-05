import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';

import { appLog } from '@documenso/lib/utils/debugger';
import { env } from '@documenso/lib/utils/env';

export const sessionCookieName = 'sessionId';

const getAuthSecret = () => {
  const authSecret = env('NEXTAUTH_SECRET');

  if (!authSecret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }

  return authSecret;
};

export const extractSessionCookieFromHeaders = (headers: Headers): string | null => {
  const cookieHeader = headers.get('cookie') || '';
  const cookiePairs = cookieHeader.split(';');
  const sessionCookie = cookiePairs.find((pair) => pair.trim().startsWith(sessionCookieName));

  if (!sessionCookie) {
    return null;
  }

  return sessionCookie.split('=')[1].trim();
};

/**
 * Get the session cookie attached to the request headers.
 *
 * @param c - The Hono context.
 * @returns The session ID or null if no session cookie is found.
 */
export const getSessionCookie = async (c: Context): Promise<string | null> => {
  const sessionId = await getSignedCookie(c, getAuthSecret(), sessionCookieName);

  return sessionId || null;
};

/**
 * Set the session cookie into the Hono context.
 *
 * @param c - The Hono context.
 * @param sessionToken - The session token to set.
 */
export const setSessionCookie = async (c: Context, sessionToken: string) => {
  await setSignedCookie(c, sessionCookieName, sessionToken, getAuthSecret(), {
    path: '/',
    // sameSite: '', // whats the default? we need to change this for embed right?
    // secure: true,
    domain: 'localhost', // todo
  }).catch((err) => {
    appLog('SetSessionCookie', `Error setting signed cookie: ${err}`);

    throw err;
  });
};
