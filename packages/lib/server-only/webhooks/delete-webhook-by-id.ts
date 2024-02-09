import { prisma } from '@documenso/prisma';

export type DeleteWebhookByIdOptions = {
  id: number;
  userId: number;
};

export const deleteWebhookById = async ({ id, userId }: DeleteWebhookByIdOptions) => {
  return await prisma.webhook.delete({
    where: {
      id,
      userId,
    },
  });
};
