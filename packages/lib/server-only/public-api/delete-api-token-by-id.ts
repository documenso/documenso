import { prisma } from '@documenso/prisma';

export type DeleteTokenByIdOptions = {
  id: number;
  userId: number;
};

export const deleteTokenById = async ({ id, userId }: DeleteTokenByIdOptions) => {
  return await prisma.apiToken.delete({
    where: {
      id,
      userId,
    },
  });
};
