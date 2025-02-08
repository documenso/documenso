import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
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

const getAuthDomain = () => {
  const url = new URL(NEXT_PUBLIC_WEBAPP_URL());

  return url.hostname;
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
    domain: getAuthDomain(),
  }).catch((err) => {
    appLog('SetSessionCookie', `Error setting signed cookie: ${err}`);

    throw err;
  });
};

/**
 * Set the session cookie into the Hono context.
 *
 * @param c - The Hono context.
 * @param sessionToken - The session token to set.
 */
export const deleteSessionCookie = (c: Context) => {
  deleteCookie(c, sessionCookieName, {
    path: '/',
    secure: true,
    domain: getAuthDomain(),
  });
};
