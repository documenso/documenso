import { prisma } from '@documenso/prisma';

import { GLOBAL_WEBHOOK_EVENTS, GLOBAL_WEBHOOK_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';

export type ClaimAuthorizationOptions = {
  claimCode: string;
};

export const claimAuthorization = async ({ claimCode }: ClaimAuthorizationOptions) => {
  const authorization = await prisma.suiteOpAuthorization.findUnique({
    where: {
      claimCode,
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      apiToken: {
        select: {
          id: true,
          token: true,
        },
      },
    },
  });

  if (!authorization) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invalid claim code',
    });
  }

  if (authorization.claimed) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'Claim code has already been used',
    });
  }

  if (authorization.expiresAt < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, {
      message: 'Claim code has expired',
    });
  }

  // Mark as claimed and clear plaintext token, and create webhook in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.suiteOpAuthorization.update({
      where: {
        id: authorization.id,
      },
      data: {
        claimed: true,
        plaintextToken: '',
      },
    });

    // Create a webhook so SuiteOp receives document events for this team
    await tx.webhook.create({
      data: {
        webhookUrl: GLOBAL_WEBHOOK_URL,
        eventTriggers: [...GLOBAL_WEBHOOK_EVENTS],
        secret: null,
        enabled: true,
        userId: authorization.userId,
        teamId: authorization.teamId,
      },
    });
  });

  return {
    token: authorization.plaintextToken,
    teamId: authorization.team.id,
    teamName: authorization.team.name,
  };
};
