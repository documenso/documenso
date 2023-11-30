import { prisma } from '@documenso/prisma';

export const checkUserFromToken = async ({ token }: { token: string }) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      ApiToken: {
        some: {
          token: token,
        },
      },
    },
  });

  return user;
};
