'use server';

import { prisma } from '@documenso/prisma';

export type GetSubscriptionByUserIdOptions = {
  userId: number;
};

export const getSubscriptionByUserId = ({ userId }: GetSubscriptionByUserIdOptions) => {
  return prisma.subscription.findFirst({
    where: {
      userId,
    },
  });
};
