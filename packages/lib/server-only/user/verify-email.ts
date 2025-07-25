import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

import { EMAIL_VERIFICATION_STATE } from '../../constants/email';
import { jobsClient } from '../../jobs/client';
import { logger } from '../../utils/logger';
import { autoAssignUserToOrganisations } from '../organisation/domain-organisation';

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

  // Auto-assign user to organisations based on email domain
  try {
    await autoAssignUserToOrganisations(updatedUser.id, updatedUser.email);
  } catch (error) {
    // Log error but don't fail email verification - auto-assignment is optional
    logger.error('Error during auto-assignment to organisations', {
      userId: updatedUser.id,
      email: updatedUser.email,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return {
    state: EMAIL_VERIFICATION_STATE.VERIFIED,
    userId: updatedUser.id,
  };
};
