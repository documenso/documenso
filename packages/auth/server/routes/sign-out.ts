import { Hono } from 'hono';

import { invalidateSession, validateSessionToken } from '../lib/session/session';
import { deleteSessionCookie, getSessionCookie } from '../lib/session/session-cookies';
import type { HonoAuthContext } from '../types/context';

export const signOutRoute = new Hono<HonoAuthContext>().post('/signout', async (c) => {
  const metadata = c.get('requestMetadata');

  const sessionId = await getSessionCookie(c);

  if (!sessionId) {
    return new Response('No session found', { status: 401 });
  }

  const { session } = await validateSessionToken(sessionId);

  if (!session) {
    return new Response('No session found', { status: 401 });
  }

  await invalidateSession(session.id, metadata);

  deleteSessionCookie(c);

  return c.status(200);
});
