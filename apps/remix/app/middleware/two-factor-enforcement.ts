import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTwoFactorEnforcementStatus } from '@documenso/lib/server-only/2fa/get-two-factor-enforcement-status';
import { type MiddlewareFunction, redirect } from 'react-router';

import { buildTwoFactorOnboardingPath } from '~/utils/two-factor-onboarding-path';

/**
 * UX redirect only, the security boundary is the tRPC/Hono asserts.
 *
 * Lives in middleware rather than the layout loader so it also runs when single
 * fetch requests a subset of loaders via `?_routes=`. `/onboarding/2fa` lives
 * outside the `_authenticated+` tree, so the redirect cannot loop.
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
