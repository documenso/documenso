import { prisma } from '@documenso/prisma';

export const getWebhooksByUserId = async (userId: number) => {
  return await prisma.webhook.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
