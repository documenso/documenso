import { TRPCError } from '@trpc/server';

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
    try {
      return await getUserTokens({ userId: ctx.user.id });
    } catch (e) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to find your API tokens. Please try again.',
      });
    }
  }),

  getTokenById: authenticatedProcedure
    .input(ZGetApiTokenByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        const { id } = input;

        return await getApiTokenById({
          id,
          userId: ctx.user.id,
        });
      } catch (e) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to find this API token. Please try again.',
        });
      }
    }),

  createToken: authenticatedProcedure
    .input(ZCreateTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { tokenName, teamId, expirationDate } = input;

        return await createApiToken({
          userId: ctx.user.id,
          teamId,
          tokenName,
          expiresIn: expirationDate,
        });
      } catch (e) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create an API token. Please try again.',
        });
      }
    }),

  deleteTokenById: authenticatedProcedure
    .input(ZDeleteTokenByIdMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, teamId } = input;

        return await deleteTokenById({
          id,
          teamId,
          userId: ctx.user.id,
        });
      } catch (e) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to delete this API Token. Please try again.',
        });
      }
    }),
});
