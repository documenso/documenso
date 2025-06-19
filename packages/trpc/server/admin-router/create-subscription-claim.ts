import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZCreateSubscriptionClaimRequestSchema,
  ZCreateSubscriptionClaimResponseSchema,
} from './create-subscription-claim.types';

export const createSubscriptionClaimRoute = adminProcedure
  .input(ZCreateSubscriptionClaimRequestSchema)
  .output(ZCreateSubscriptionClaimResponseSchema)
  .mutation(async ({ input }) => {
    const { name, teamCount, memberCount, flags } = input;

    await prisma.subscriptionClaim.create({
      data: {
        name,
        teamCount,
        memberCount,
        flags,
      },
    });
  });
