import { prisma } from '@documenso/prisma';

export interface GetLastVerificationTokenOptions {
  userId: number;
}

export const getLastVerificationToken = async ({ userId }: GetLastVerificationTokenOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      VerificationToken: {
        select: {
          expires: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  return user.VerificationToken;
};
