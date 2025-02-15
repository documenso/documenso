import { Hono } from 'hono';

import type { SessionValidationResult } from '../lib/session/session';
import { getOptionalSession } from '../lib/utils/get-session';

export const sessionRoute = new Hono().get('/session', async (c) => {
  const session: SessionValidationResult = await getOptionalSession(c);

  return c.json(session);
});
