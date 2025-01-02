import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';

import { authDebugger } from '../utils/debugger';

/**
 * Get the session cookie attached to the request headers.
 *
 * @param c - The Hono context.
 */
export const getSessionCookie = async (c: Context) => {
  const sessionId = await getSignedCookie(c, 'secret', 'sessionId');

  return sessionId;
};

/**
 * Set the session cookie into the Hono context.
 *
 * @param c - The Hono context.
 * @param sessionToken - The session token to set.
 */
export const setSessionCookie = async (c: Context, sessionToken: string) => {
  await setSignedCookie(c, 'sessionId', sessionToken, 'secret', {
    path: '/',
    // sameSite: '', // whats the default? we need to change this for embed right?
    // secure: true,
    domain: 'localhost', // todo
  }).catch((err) => {
    authDebugger(`Error setting signed cookie: ${err}`);

    throw err;
  });
};
