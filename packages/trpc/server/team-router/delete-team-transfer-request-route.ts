import { z } from 'zod';

import { requestTeamOwnershipTransfer } from '@documenso/lib/server-only/team/request-team-ownership-transfer';

import { authenticatedProcedure } from '../trpc';

export const ZDeleteTeamTransferRequestSchema = z.object({
  teamId: z.number(),
  newOwnerUserId: z.number(),
  clearPaymentMethods: z.boolean(),
});

export const deleteTeamTransferRequestRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/transfer',
  //     summary: 'Request a team ownership transfer',
  //     description: '',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZDeleteTeamTransferRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await requestTeamOwnershipTransfer({
      userId: ctx.user.id,
      userName: ctx.user.name ?? '',
      ...input,
    });
  });
