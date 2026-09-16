import { getTwoFactorEnforcementStatus } from '@documenso/lib/server-only/2fa/get-two-factor-enforcement-status';
import type { TTwoFactorEnforcementStatus } from '@documenso/lib/utils/two-factor';
import { Hono } from 'hono';
import superjson from 'superjson';

import type { SessionValidationResult } from '../lib/session/session';
import { getActiveSessions, getOptionalSession } from '../lib/utils/get-session';

/**
 * The payload consumed by the client session provider. The instance 2FA
 * enforcement status rides along with the session so the client can expose it
 * without any extra queries.
 */
export type TSessionJsonResponse = SessionValidationResult & {
  twoFactorEnforcement: TTwoFactorEnforcementStatus;
};

export const sessionRoute = new Hono()
  .get('/session', async (c) => {
    const session: SessionValidationResult = await getOptionalSession(c);

    return c.json(session);
  })
  .get('/sessions', async (c) => {
    const sessions = await getActiveSessions(c);

    return c.json(superjson.serialize({ sessions }));
  })
  .get('/session-json', async (c) => {
    const session: SessionValidationResult = await getOptionalSession(c);

    const twoFactorEnforcement: TTwoFactorEnforcementStatus = session.isAuthenticated
      ? await getTwoFactorEnforcementStatus({ user: session.user, session: session.session })
      : { required: false };

    const response: TSessionJsonResponse = { ...session, twoFactorEnforcement };

    return c.json(superjson.serialize(response));
  });
