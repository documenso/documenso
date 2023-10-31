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
      token,
    },
  });

  if (!dbToken) {
    throw new Error('Invalid token provided. Please try again.');
  }

  // check if the token is valid or expired
  const valid = dbToken.expires > new Date();

  if (!valid) {
    // if the token is expired, generate a new token and send the email
    // and return false
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

  if (!updatedUsers || !deletedToken) {
    throw new Error('Something went wrong while verifying your email. Please try again.');
  }

  return !!updatedUsers && !!deletedToken;
};
