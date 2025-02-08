import { SubscriptionStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type GetActiveSubscriptionsByUserIdOptions = {
  userId: number;
};

export const getActiveSubscriptionsByUserId = async ({
  userId,
}: GetActiveSubscriptionsByUserIdOptions) => {
  return await prisma.subscription.findMany({
    where: {
      userId,
      status: {
        not: SubscriptionStatus.INACTIVE,
      },
    },
  });
};
