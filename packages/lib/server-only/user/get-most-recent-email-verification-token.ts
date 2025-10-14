import { prisma } from '@documenso/prisma';

import { USER_SIGNUP_VERIFICATION_TOKEN_IDENTIFIER } from '../../constants/email';

export type getMostRecentEmailVerificationTokenOptions = {
  userId: number;
};

export const getMostRecentEmailVerificationToken = async ({
  userId,
}: getMostRecentEmailVerificationTokenOptions) => {
  return await prisma.verificationToken.findFirst({
    where: {
      userId,
      identifier: USER_SIGNUP_VERIFICATION_TOKEN_IDENTIFIER,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
