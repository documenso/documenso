import { prisma } from '@documenso/prisma';

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

  // Mark as claimed and clear plaintext token
  await prisma.suiteOpAuthorization.update({
    where: {
      id: authorization.id,
    },
    data: {
      claimed: true,
      plaintextToken: '', // Clear plaintext token after claiming
    },
  });

  return {
    token: authorization.plaintextToken,
    teamId: authorization.team.id,
    teamName: authorization.team.name,
  };
};
