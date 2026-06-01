import { assertUserNotDisabledById } from '@documenso/lib/server-only/user/assert-user-not-disabled';
import type { Context } from 'hono';

import type { HonoAuthContext } from '../../types/context';
import { createSession, generateSessionToken } from '../session/session';
import { setSessionCookie } from '../session/session-cookies';

type AuthorizeUser = {
  userId: number;
};

/**
 * Handles creating a session.
 *
 * Refuses to issue a session for a disabled account. This is the single
 * chokepoint shared by every sign-in path (email/password, passkey, OAuth,
 * OIDC, organisation OIDC), so the guard belongs here rather than in each
 * caller.
 */
export const onAuthorize = async (user: AuthorizeUser, c: Context<HonoAuthContext>) => {
  await assertUserNotDisabledById({ userId: user.userId });

  const metadata = c.get('requestMetadata');

  const sessionToken = generateSessionToken();

  await createSession(sessionToken, user.userId, metadata);

  await setSessionCookie(c, sessionToken);
};
