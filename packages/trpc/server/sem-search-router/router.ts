import { TRPCError } from '@trpc/server';

import { disableSemSearch } from '@documenso/lib/server-only/sem-search/disable-sem-search';
import { enableSemSearch } from '@documenso/lib/server-only/sem-search/enable-sem-search';
import { runSemSearch } from '@documenso/lib/server-only/sem-search/run-sem-search';

import { authenticatedProcedure, router } from '../trpc';
import { ZSemSearchQuery } from './schema';

export const semSearchRouter = router({
  enable: authenticatedProcedure.mutation(async ({ ctx }) => {
    try {
      const user = ctx.user;

      return await enableSemSearch(user);
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to enable semantic search. Please try again later.',
      });
    }
  }),

  disable: authenticatedProcedure.mutation(async ({ ctx }) => {
    try {
      const user = ctx.user;

      return await disableSemSearch(user);
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to disable semantic search. Please try again later.',
      });
    }
  }),

  run: authenticatedProcedure.input(ZSemSearchQuery).mutation(async ({ ctx, input }) => {
    try {
      const user = ctx.user;

      const { user_query } = input;

      return await runSemSearch(user, user_query);
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Bad Search Request',
      });
    }
  }),
});
