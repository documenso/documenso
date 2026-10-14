import { getUserAuthMethods } from '@documenso/lib/server-only/user/get-user-auth-methods';

import { authenticatedProcedure } from '../trpc';
import { ZGetAuthMethodsResponseSchema } from './get-auth-methods.types';

/**
 * Get the sign in methods available to the current user.
 */
export const getAuthMethodsRoute = authenticatedProcedure
  .output(ZGetAuthMethodsResponseSchema)
  .query(async ({ ctx }) => {
    const authMethods = await getUserAuthMethods({
      userId: ctx.user.id,
    });

    return {
      authMethods,
    };
  });
