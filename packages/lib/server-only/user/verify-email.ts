import { prisma } from '@documenso/prisma';

import { sendConfirmationToken } from './send-confirmation-token';

export type VerifyEmailProps = {
  token: string;
};

export const verifyEmail = async ({ token }: VerifyEmailProps) => {
  const verificationToken = await prisma.verificationToken.findFirst({
    include: {
      user: true,
    },
    where: {
      token,
    },
  });

  if (!verificationToken) {
    return null;
  }

  // check if the token is valid or expired
  const valid = verificationToken.expires > new Date();

  if (!valid) {
    // if the token is expired, generate a new token and send the email
    // and return false
    await sendConfirmationToken({ email: verificationToken.user.email });
    return valid;
  }

  const [updatedUser, deletedToken] = await prisma.$transaction([
    prisma.user.update({
      where: {
        id: verificationToken.userId,
      },
      data: {
        emailVerified: new Date(),
      },
    }),
    prisma.verificationToken.deleteMany({
      where: {
        userId: verificationToken.userId,
      },
    }),
  ]);

  if (!updatedUser || !deletedToken) {
    throw new Error('Something went wrong while verifying your email. Please try again.');
  }

  return !!updatedUser && !!deletedToken;
};
