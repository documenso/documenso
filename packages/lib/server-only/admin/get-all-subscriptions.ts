import { prisma } from '@documenso/prisma';

export const findSubscriptions = async () => {
  return prisma.subscription.findMany({
    select: {
      id: true,
      status: true,
      createdAt: true,
      periodEnd: true,
      userId: true,
    },
  });
};
