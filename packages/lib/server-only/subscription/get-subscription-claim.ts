import { INTERNAL_CLAIM_ID, internalClaims } from '@documenso/lib/types/subscription';

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
    // Temporary fallback for free claim so we don't break self-hosters who somehow removed it
    // from the database.
    if (claimId === INTERNAL_CLAIM_ID.FREE) {
      return internalClaims[INTERNAL_CLAIM_ID.FREE];
    }

    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Subscription claim ${claimId} not found`,
    });
  }

  return subscriptionClaim;
};
