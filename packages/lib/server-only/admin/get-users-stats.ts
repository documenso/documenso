import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@documenso/prisma/client';

export const getUsersCount = async () => {
  return await prisma.user.count();
};

export const getUsersWithSubscriptionsCount = async () => {
  return await prisma.user.count({
    where: {
      Subscription: {
        some: {
          status: SubscriptionStatus.ACTIVE,
        },
      },
    },
  });
};
