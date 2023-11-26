import { prisma } from '@documenso/prisma';

export interface GetUserByIdOptions {
  id: number;
}

export const isPasswordNull = async ({ id }: GetUserByIdOptions) => {
  const data = await prisma.user.findFirstOrThrow({
    where: {
      id,
    },
    select: {
      password: true,
    },
  });
  if (data.password === null) {
    return true;
  }
  return false;
};
