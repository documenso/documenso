import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { deleteTokenById } from '@documenso/lib/server-only/public-api/delete-api-token-by-id';
import { getUserTokens } from '@documenso/lib/server-only/public-api/get-all-user-tokens';
import { getApiTokenById } from '@documenso/lib/server-only/public-api/get-api-token-by-id';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateTokenMutationSchema,
  ZDeleteTokenByIdMutationSchema,
  ZGetApiTokenByIdQuerySchema,
} from './schema';

export const apiTokenRouter = router({
  getTokens: authenticatedProcedure.query(async ({ ctx }) => {
    return await getUserTokens({ userId: ctx.user.id });
  }),

  getTokenById: authenticatedProcedure
    .input(ZGetApiTokenByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      const { id } = input;

      return await getApiTokenById({
        id,
        userId: ctx.user.id,
      });
    }),

  createToken: authenticatedProcedure
    .input(ZCreateTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { tokenName, teamId, expirationDate } = input;

      return await createApiToken({
        userId: ctx.user.id,
        teamId,
        tokenName,
        expiresIn: expirationDate,
      });
    }),

  deleteTokenById: authenticatedProcedure
    .input(ZDeleteTokenByIdMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, teamId } = input;

      return await deleteTokenById({
        id,
        teamId,
        userId: ctx.user.id,
      });
    }),
});
