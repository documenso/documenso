import { Hono } from 'hono';

import type { SessionValidationResult } from '../lib/session/session';
import { getSession } from '../lib/utils/get-session';

export const sessionRoute = new Hono().get('/session', async (c) => {
  const session: SessionValidationResult = await getSession(c);

  return c.json(session);
});
