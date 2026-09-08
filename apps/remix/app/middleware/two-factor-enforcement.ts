import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTwoFactorEnforcementStatus } from '@documenso/lib/server-only/2fa/get-two-factor-enforcement-status';
import { type MiddlewareFunction, redirect } from 'react-router';

import { buildTwoFactorOnboardingPath } from '~/utils/two-factor-onboarding-path';

/**
 * Instance-wide 2FA enforcement for the `_authenticated+` route tree (UX
 * chokepoint — the security boundary is the tRPC/Hono asserts): a blocked
 * user is redirected into forced enrolment.
 *
 * Lives in middleware rather than the layout loader, alongside
 * `authenticatedMiddleware`, so it also runs when single fetch requests a
 * subset of loaders via `?_routes=` and on every child navigation even though
 * the layout itself does not revalidate.
 *
 * `/onboarding/2fa` lives outside this route tree, so the redirect cannot
 * loop. Never blocks login itself — signin/onboarding are outside the tree
 * too. Must run after `authenticatedMiddleware`; an anonymous request is
 * passed through for that gate to handle.
 */
export const twoFactorEnforcementMiddleware: MiddlewareFunction = async ({ request }, next) => {
  const { user, session } = await getOptionalSession(request);

  if (!user || !session) {
    return next();
  }

  const twoFactorEnforcement = await getTwoFactorEnforcementStatus({
    user,
    session,
  });

  if (twoFactorEnforcement.required && twoFactorEnforcement.isBlocked) {
    const url = new URL(request.url);

    throw redirect(buildTwoFactorOnboardingPath(`${url.pathname}${url.search}`));
  }

  return next();
};
