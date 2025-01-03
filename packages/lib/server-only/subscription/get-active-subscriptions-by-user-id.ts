'use server';

import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@documenso/prisma/client';

export type GetActiveSubscriptionsByUserIdOptions = {
  userId: string;
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
