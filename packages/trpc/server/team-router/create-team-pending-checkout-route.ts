import { z } from 'zod';

import { createTeamPendingCheckoutSession } from '@documenso/lib/server-only/team/create-team-checkout-session';

import { authenticatedProcedure } from '../trpc';

export const ZCreateTeamPendingCheckoutRouteRequestSchema = z.object({
  interval: z.union([z.literal('monthly'), z.literal('yearly')]),
  pendingTeamId: z.number(),
});

export const createTeamPendingCheckoutRoute = authenticatedProcedure
  .input(ZCreateTeamPendingCheckoutRouteRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await createTeamPendingCheckoutSession({
      userId: ctx.user.id,
      ...input,
    });
  });
