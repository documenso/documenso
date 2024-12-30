import { z } from 'zod';

import { createTeamBillingPortal } from '@documenso/lib/server-only/team/create-team-billing-portal';

import { authenticatedProcedure } from '../trpc';

export const ZCreateBillingPortalRequestSchema = z.object({
  teamId: z.number(),
});

export const createBillingPortalRoute = authenticatedProcedure
  .input(ZCreateBillingPortalRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await createTeamBillingPortal({
      userId: ctx.user.id,
      ...input,
    });
  });
