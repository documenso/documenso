import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZCreateSubscriptionClaimRequestSchema,
  ZCreateSubscriptionClaimResponseSchema,
} from './create-subscription-claim.types';

export const createSubscriptionClaimRoute = adminProcedure
  .input(ZCreateSubscriptionClaimRequestSchema)
  .output(ZCreateSubscriptionClaimResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name, teamCount, memberCount, envelopeItemCount, flags } = input;

    ctx.logger.info({
      input,
    });

    await prisma.subscriptionClaim.create({
      data: {
        name,
        teamCount,
        envelopeItemCount,
        memberCount,
        flags,
      },
    });
  });
