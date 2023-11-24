import { prisma } from '@documenso/prisma';

export type GetApiTokenByIdOptions = {
  id: number;
  userId: number;
};

export const getApiTokenById = async ({ id, userId }: GetApiTokenByIdOptions) => {
  return prisma.apiToken.findFirstOrThrow({
    where: {
      id,
      userId,
    },
  });
};
