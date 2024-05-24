import { prisma } from '@documenso/prisma';

export type DeleteWebhookByIdOptions = {
  id: string;
  userId: number;
  teamId?: number;
};

export const deleteWebhookById = async ({ id, userId, teamId }: DeleteWebhookByIdOptions) => {
  return await prisma.webhook.delete({
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
