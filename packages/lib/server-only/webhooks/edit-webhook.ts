import type { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type EditWebhookOptions = {
  id: string;
  data: Prisma.WebhookUpdateInput;
  userId: number;
};

export const editWebhook = async ({ id, data, userId }: EditWebhookOptions) => {
  return await prisma.webhook.update({
    where: {
      id,
      userId,
    },
    data: {
      ...data,
    },
  });
};
