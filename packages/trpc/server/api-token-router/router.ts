import { TRPCError } from '@trpc/server';

import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { deleteApiTokenById } from '@documenso/lib/server-only/public-api/delete-api-token-by-id';
import { getApiTokenById } from '@documenso/lib/server-only/public-api/get-api-token-by-id';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateTokenMutationSchema,
  ZDeleteTokenByIdMutationSchema,
  ZGetApiTokenByIdQuerySchema,
} from './schema';

export const apiTokenRouter = router({
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
        const { tokenName } = input;
        return await createApiToken({
          userId: ctx.user.id,
          tokenName,
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
        const { id } = input;

        return await deleteApiTokenById({
          id,
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
