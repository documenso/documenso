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
  // Only serves the signing-link re-auth dialog, which is exempt by design, and
  // there is no token in the input to skip on conditionally.
  .use(twoFactorBootstrap())
  .query(async ({ ctx }) => {
    const authMethods = await getUserAuthMethods({
      userId: ctx.user.id,
    });

    return {
      authMethods,
    };
  });
