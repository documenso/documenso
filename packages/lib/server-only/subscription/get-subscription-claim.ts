import { prisma } from '@documenso/prisma';
import type { SubscriptionClaim } from '@prisma/client';
import { AppError, AppErrorCode } from '../../errors/app-error';

export const getSubscriptionClaim = async (
  claimId: string,
): Promise<Omit<SubscriptionClaim, 'createdAt' | 'updatedAt'>> => {
  const subscriptionClaim = await prisma.subscriptionClaim.findFirst({
    where: { id: claimId },
  });

  if (!subscriptionClaim) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Subscription claim ${claimId} not found`,
    });
  }

  return subscriptionClaim;
};
