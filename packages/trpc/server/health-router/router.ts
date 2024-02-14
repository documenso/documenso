import { TRPCError } from '@trpc/server';
import { procedure, router } from '../trpc';
import { z } from 'zod';

export const healthRouter = router({
  health: procedure
    .query(() => {
      return { status: 'ok' };
    }),
});
