import { prisma } from '@documenso/prisma';

export type GetWebhookByIdOptions = {
  id: string;
  userId: number;
};

export const getWebhookById = async ({ id, userId }: GetWebhookByIdOptions) => {
  return await prisma.webhook.findFirstOrThrow({
    where: {
      id,
      userId,
    },
  });
};
