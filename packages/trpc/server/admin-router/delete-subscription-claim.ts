import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZDeleteSubscriptionClaimRequestSchema,
  ZDeleteSubscriptionClaimResponseSchema,
} from './delete-subscription-claim.types';

export const deleteSubscriptionClaimRoute = adminProcedure
  .input(ZDeleteSubscriptionClaimRequestSchema)
  .output(ZDeleteSubscriptionClaimResponseSchema)
  .mutation(async ({ input }) => {
    const { id } = input;

    const existingClaim = await prisma.subscriptionClaim.findFirst({
      where: {
        id,
      },
    });

    if (!existingClaim) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Subscription claim not found' });
    }

    if (existingClaim.locked) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot delete locked subscription claim',
      });
    }

    await prisma.subscriptionClaim.delete({
      where: {
        id,
      },
    });
  });
