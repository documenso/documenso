import { z } from 'zod';

import { findTeamInvoices } from '@documenso/lib/server-only/team/find-team-invoices';

import { authenticatedProcedure } from '../trpc';

export const ZFindTeamInvoicesResponseSchema = z.object({
  teamId: z.number(),
});

export const findTeamInvoicesRoute = authenticatedProcedure
  .input(ZFindTeamInvoicesResponseSchema)
  .query(async ({ input, ctx }) => {
    return await findTeamInvoices({
      userId: ctx.user.id,
      ...input,
    });
  });
