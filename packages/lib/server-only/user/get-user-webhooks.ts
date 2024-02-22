import { prisma } from '@documenso/prisma';

export interface GetUserWebhooksByIdOptions {
  id: number;
}

export const getUserWebhooksById = async ({ id }: GetUserWebhooksByIdOptions) => {
  return await prisma.user.findFirstOrThrow({
    where: {
      id,
    },
    select: {
      email: true,
      Webhooks: true,
    },
  });
};
