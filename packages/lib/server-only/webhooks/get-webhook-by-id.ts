import { prisma } from '@documenso/prisma';

export type GetWebhookByIdOptions = {
  id: string;
  userId: number;
  teamId?: number;
};

export const getWebhookById = async ({ id, userId, teamId }: GetWebhookByIdOptions) => {
  return await prisma.webhook.findFirstOrThrow({
    where: {
      id,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
  });
};
