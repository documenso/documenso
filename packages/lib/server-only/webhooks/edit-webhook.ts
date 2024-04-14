import type { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type EditWebhookOptions = {
  id: string;
  data: Omit<Prisma.WebhookUpdateInput, 'id' | 'userId' | 'teamId'>;
  userId: number;
  teamId?: number;
};

export const editWebhook = async ({ id, data, userId, teamId }: EditWebhookOptions) => {
  return await prisma.webhook.update({
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
    data: {
      ...data,
    },
  });
};
