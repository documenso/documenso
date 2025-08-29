import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

import { EMAIL_VERIFICATION_STATE } from '../../constants/email';
import { jobsClient } from '../../jobs/client';

export type VerifyEmailProps = {
  token: string;
};

export const verifyEmail = async ({ token }: VerifyEmailProps) => {
  const verificationToken = await prisma.verificationToken.findFirst({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    where: {
      token,
    },
  });

  if (!verificationToken) {
    return {
      state: EMAIL_VERIFICATION_STATE.NOT_FOUND,
      userId: null,
    };
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
      await jobsClient.triggerJob({
        name: 'send.signup.confirmation.email',
        payload: {
          email: verificationToken.user.email,
        },
      });
    }

    return {
      state: EMAIL_VERIFICATION_STATE.EXPIRED,
      userId: null,
    };
  }

  if (verificationToken.completed) {
    return {
      state: EMAIL_VERIFICATION_STATE.ALREADY_VERIFIED,
      userId: null,
    };
  }

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: {
        id: verificationToken.userId,
      },
      data: {
        emailVerified: new Date(),
      },
    }),
    prisma.verificationToken.updateMany({
      where: {
        userId: verificationToken.userId,
      },
      data: {
        completed: true,
      },
    }),
    // Tidy up old expired tokens
    prisma.verificationToken.deleteMany({
      where: {
        userId: verificationToken.userId,
        expires: {
          lt: new Date(),
        },
      },
    }),
  ]);

  if (!updatedUser) {
    throw new Error('Something went wrong while verifying your email. Please try again.');
  }

  return {
    state: EMAIL_VERIFICATION_STATE.VERIFIED,
    userId: updatedUser.id,
  };
};
