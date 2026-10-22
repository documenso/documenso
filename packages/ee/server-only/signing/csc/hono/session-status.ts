import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { getCscBlockingErrorCookie } from '../cookies/blocking-error-cookie';
import { getCscSadSessionCookie } from '../cookies/sad-session-cookie';
import { getCscServiceSessionCookie } from '../cookies/service-session-cookie';
import type { HonoCscEnv } from './context';

// The CSC cookies are httpOnly, so this is how the embed iframe learns whether
// the browser kept the redeemed cookie. Reveals only whether the caller's own
// token/session id matches.
const ZSessionStatusQuerySchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('service'),
    token: z.string().min(1),
  }),
  z.object({
    scope: z.literal('credential'),
    sessionId: z.string().min(1),
  }),
]);

export const cscSessionStatusRoute = new Hono<HonoCscEnv>().get(
  '/',
  sValidator('query', ZSessionStatusQuerySchema),
  async (c) => {
    const query = c.req.valid('query');

    if (query.scope === 'credential') {
      const sadSessionId = await getCscSadSessionCookie(c);

      return c.json({ active: sadSessionId === query.sessionId });
    }

    const serviceSessionToken = await getCscServiceSessionCookie(c);

    if (serviceSessionToken === query.token) {
      return c.json({ active: true });
    }

    // A blocked service-scope flow also counts as landed; the iframe reloads to render it.
    const blockingError = await getCscBlockingErrorCookie(c);

    return c.json({ active: blockingError?.recipientToken === query.token });
  },
);
