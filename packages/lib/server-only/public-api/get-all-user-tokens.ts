import { prisma } from '@documenso/prisma';

export type GetUserTokensOptions = {
  userId: number;
};

export const getUserTokens = async ({ userId }: GetUserTokensOptions) => {
  return prisma.apiToken.findMany({
    where: {
      userId,
    },
  });
};
