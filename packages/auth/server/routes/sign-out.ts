import { Hono } from 'hono';
import { deleteCookie, getSignedCookie } from 'hono/cookie';

import { invalidateSession, validateSessionToken } from '../lib/session/session';

export const signOutRoute = new Hono().post('/signout', async (c) => {
  // todo: secret
  const sessionId = await getSignedCookie(c, 'secret', 'sessionId');

  if (!sessionId) {
    return new Response('No session found', { status: 401 });
  }

  const { session } = await validateSessionToken(sessionId);

  if (!session) {
    return new Response('No session found', { status: 401 });
  }

  await invalidateSession(session.id);

  deleteCookie(c, 'sessionId', {
    path: '/',
    secure: true,
    domain: 'example.com',
  });

  return c.status(200);
});
