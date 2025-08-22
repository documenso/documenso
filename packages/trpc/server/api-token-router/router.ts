import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { deleteTokenById } from '@documenso/lib/server-only/public-api/delete-api-token-by-id';
import { getApiTokens } from '@documenso/lib/server-only/public-api/get-api-tokens';

import { authenticatedProcedure, router } from '../trpc';
import { ZCreateTokenMutationSchema, ZDeleteTokenByIdMutationSchema } from './schema';

export const apiTokenRouter = router({
  getTokens: authenticatedProcedure.query(async ({ ctx }) => {
    return await getApiTokens({ userId: ctx.user.id, teamId: ctx.teamId });
  }),

  createToken: authenticatedProcedure
    .input(ZCreateTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { tokenName, teamId, expirationDate } = input;

      ctx.logger.info({
        input: {
          teamId,
        },
      });

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

      ctx.logger.info({
        input: {
          id,
          teamId,
        },
      });

      return await deleteTokenById({
        id,
        teamId,
        userId: ctx.user.id,
      });
    }),
});
