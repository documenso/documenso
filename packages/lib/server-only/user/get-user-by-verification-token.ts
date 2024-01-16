import { prisma } from '@documenso/prisma';

export interface GetUserByVerificationTokenOptions {
  token: string;
}

export const getUserByVerificationToken = async ({ token }: GetUserByVerificationTokenOptions) => {
  return await prisma.user.findFirstOrThrow({
    where: {
      VerificationToken: {
        some: {
          token,
        },
      },
    },
  });
};
