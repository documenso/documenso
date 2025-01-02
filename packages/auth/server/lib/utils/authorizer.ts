import type { Context } from 'hono';

import type { HonoAuthContext } from '../../types/context';
import { createSession, generateSessionToken } from '../session/session';
import { setSessionCookie } from '../session/session-cookies';

type AuthorizeUser = {
  userId: number;
};

/**
 * Handles creating a session.
 */
export const onAuthorize = async (user: AuthorizeUser, c: Context<HonoAuthContext>) => {
  const metadata = c.get('requestMetadata');

  const sessionToken = generateSessionToken();

  await createSession(sessionToken, user.userId, metadata);

  await setSessionCookie(c, sessionToken);

  // Todo.
  // Create the Stripe customer and attach it to the user if it doesn't exist.
  // if (user.customerId === null && IS_BILLING_ENABLED()) {
  //   await getStripeCustomerByUser(user).catch((err) => {
  //     console.error(err);
  //   });
  // }
};
