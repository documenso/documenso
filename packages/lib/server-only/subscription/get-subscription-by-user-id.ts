'use server';

import { prisma } from '@documenso/prisma';

export type GetSubscriptionByUserIdOptions = {
  userId: number;
};

export const getSubscriptionByUserId = async ({ userId }: GetSubscriptionByUserIdOptions) => {
  return await prisma.subscription.findFirst({
    where: {
      userId,
    },
  });
};
