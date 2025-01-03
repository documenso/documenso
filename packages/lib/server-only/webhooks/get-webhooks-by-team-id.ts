import { prisma } from '@documenso/prisma';

export const getWebhooksByTeamId = async (teamId: number, userId: string) => {
  return await prisma.webhook.findMany({
    where: {
      team: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
