import { prisma } from '@documenso/prisma';

import { generateConfirmationToken } from './generate-confirmation-token';

export type VerifyEmailProps = {
  token: string;
};

export const verifyEmail = async ({ token }: VerifyEmailProps) => {
  const dbToken = await prisma.verificationToken.findFirst({
    include: {
      user: true,
    },
    where: {
      token: token,
    },
  });

  if (!dbToken) {
    throw new Error('Invalid token provided. Please try again.');
  }

  // check if the token is valid or expired
  const valid = dbToken.expires > new Date();

  console.log('valid', valid);

  if (!valid) {
    // if the token is expired, generate a new token and send the email
    await generateConfirmationToken({ email: dbToken.user.email });
    return valid;
  }

  const [updatedUsers, deletedToken] = await prisma.$transaction([
    prisma.user.update({
      where: {
        id: dbToken.userId,
      },
      data: {
        emailVerified: new Date(),
      },
    }),
    prisma.verificationToken.deleteMany({
      where: {
        userId: dbToken.userId,
      },
    }),
  ]);

  console.log('dbToken', dbToken);
  console.log('!!updatedUsers && !!deletedToken', !!updatedUsers && !!deletedToken);

  return !!updatedUsers && !!deletedToken;
};
