import { DateTime } from 'luxon';

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
    const mostRecentToken = await prisma.verificationToken.findFirst({
      where: {
        userId: verificationToken.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // If there isn't a recent token or it's older than 1 hour, send a new token
    if (
      !mostRecentToken ||
      DateTime.now().minus({ hours: 1 }).toJSDate() > mostRecentToken.createdAt
    ) {
      await sendConfirmationToken({ email: verificationToken.user.email });
    }

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
