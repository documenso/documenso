import { prisma } from '@documenso/prisma';

export interface GetUserByIdOptions {
  id: number;
}

export const getUserById = async ({ id }: GetUserByIdOptions) => {
  return await prisma.user.findFirstOrThrow({
    where: {
      id,
    },
  });
};
