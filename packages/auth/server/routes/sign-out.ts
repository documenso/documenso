import { Hono } from 'hono';

import {
  invalidateAllUserSessions,
  invalidateSession,
  invalidateSpecificSession,
  validateSessionToken,
} from '../lib/session/session';
import { deleteSessionCookie, getSessionCookie } from '../lib/session/session-cookies';
import type { HonoAuthContext } from '../types/context';

export const signOutRoute = new Hono<HonoAuthContext>()
  .post('/signout', async (c) => {
    const metadata = c.get('requestMetadata');
    const sessionId = await getSessionCookie(c);

    if (!sessionId) {
      return c.json({ message: 'No session found' }, 401);
    }

    const { session } = await validateSessionToken(sessionId);

    if (!session) {
      deleteSessionCookie(c);
      return c.json({ message: 'Invalid session' }, 401);
    }

    await invalidateSession(session.id, metadata);
    deleteSessionCookie(c);

    return c.json({ message: 'Successfully signed out.' }, 200);
  })
  .post('/signout-all', async (c) => {
    const metadata = c.get('requestMetadata');
    const sessionId = await getSessionCookie(c);

    if (!sessionId) {
      return c.json({ message: 'No session found' }, 401);
    }

    const { session } = await validateSessionToken(sessionId);

    if (!session) {
      deleteSessionCookie(c);
      return c.json({ message: 'Invalid session' }, 401);
    }

    const userId = session.userId;

    await invalidateAllUserSessions(userId, metadata);
    deleteSessionCookie(c);

    return c.json({ message: 'Successfully signed out of all sessions.' }, 200);
  })
  .post('/signout-session/:sessionId', async (c) => {
    const metadata = c.get('requestMetadata');
    const sessionId = await getSessionCookie(c);
    const targetSessionId = c.req.param('sessionId');

    if (!sessionId) {
      return c.json({ message: 'No current session found' }, 401);
    }

    const { session, user, isAuthenticated } = await validateSessionToken(sessionId);

    if (!isAuthenticated || !session) {
      deleteSessionCookie(c);
      return c.json({ message: 'Invalid session' }, 401);
    }

    await invalidateSpecificSession(user.id, session.id, targetSessionId, metadata);
    if (session.id === targetSessionId) {
      deleteSessionCookie(c);
    }

    return c.json({ message: 'Successfully signed out the specified session.' }, 200);
  });
