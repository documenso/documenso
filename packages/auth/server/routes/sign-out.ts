import { Hono } from 'hono';

import { invalidateSession, validateSessionToken } from '../lib/session/session';
import { deleteSessionCookie, getSessionCookie } from '../lib/session/session-cookies';

export const signOutRoute = new Hono().post('/signout', async (c) => {
  const sessionId = await getSessionCookie(c);

  if (!sessionId) {
    return new Response('No session found', { status: 401 });
  }

  const { session } = await validateSessionToken(sessionId);

  if (!session) {
    return new Response('No session found', { status: 401 });
  }

  await invalidateSession(session.id);

  deleteSessionCookie(c);

  return c.status(200);
});
