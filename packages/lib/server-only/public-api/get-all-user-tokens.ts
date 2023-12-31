import { prisma } from '@documenso/prisma';

export type GetUserTokensOptions = {
  userId: number;
};

export const getUserTokens = async ({ userId }: GetUserTokensOptions) => {
  return await prisma.apiToken.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      name: true,
      algorithm: true,
      createdAt: true,
      expires: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
