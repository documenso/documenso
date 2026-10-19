import { getUserAuthMethods } from '@documenso/lib/server-only/user/get-user-auth-methods';

import { authenticatedProcedure } from '../trpc';
import { twoFactorBootstrap } from '../two-factor-enforcement/enforce';
import { ZGetAuthMethodsResponseSchema } from './get-auth-methods.types';

/**
 * Get the sign in methods available to the current user.
 */
export const getAuthMethodsRoute = authenticatedProcedure
  .meta({ allowEmbedSession: true })
  .output(ZGetAuthMethodsResponseSchema)
  // 2FA enforcement exemption (bootstrap, BOTH asserts): this only serves the
  // signing-link re-auth dialog — a signed-in (or embed-session) user signing
  // someone else's document, which is exempt by design (see the
  // `TWO_FACTOR_SKIP` token-authorized routes). There is no token in the
  // input to skip on conditionally, and the response is limited to the
  // calling user's own sign-in method names.
  .use(twoFactorBootstrap())
  .query(async ({ ctx }) => {
    const authMethods = await getUserAuthMethods({
      userId: ctx.user.id,
    });

    return {
      authMethods,
    };
  });
