import { prisma } from '@documenso/prisma';

export type GetMostRecentVerificationTokenByUserIdOptions = {
  userId: string;
};

export const getMostRecentVerificationTokenByUserId = async ({
  userId,
}: GetMostRecentVerificationTokenByUserIdOptions) => {
  return await prisma.verificationToken.findFirst({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
