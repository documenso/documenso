import { assertUserNotDisabledById } from '@documenso/lib/server-only/user/assert-user-not-disabled';
import type { TSessionAuthMethod } from '@documenso/lib/types/session-auth-method';
import type { Context } from 'hono';

import type { HonoAuthContext } from '../../types/context';
import { createSession, generateSessionToken } from '../session/session';
import { setSessionCookie } from '../session/session-cookies';
import { sweepPendingTwoFactorChallenge } from './two-factor-challenge';

type AuthorizeUser = {
  userId: number;

  /**
   * The method the user authenticated with. Every sign-in route must pass
   * this explicitly.
   */
  authMethod: TSessionAuthMethod;

  /**
   * Whether a second factor was passed during this sign-in (inline TOTP on
   * email/password login, or a UV passkey).
   */
  twoFactorVerified: boolean;
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

  // Any successful sign-in clears a pending 2FA challenge — an abandoned
  // challenge must not outlive a login via another route. The challenge
  // endpoint consumes its own token before calling `onAuthorize`, so this
  // sweep finds nothing there (no recursion, no double-consumption).
  await sweepPendingTwoFactorChallenge(c);

  const metadata = c.get('requestMetadata');

  const sessionToken = generateSessionToken();

  await createSession(sessionToken, user.userId, metadata, {
    authMethod: user.authMethod,
    twoFactorVerified: user.twoFactorVerified,
  });

  await setSessionCookie(c, sessionToken);
};
