import { prisma } from '@documenso/prisma';

export const getWebhooksByUserId = async (userId: string) => {
  return await prisma.webhook.findMany({
    where: {
      userId,
      teamId: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
