import { type User, UserSecurityAuditLogType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getBackupCodes } from './get-backup-code';
import { verifyTwoFactorAuthenticationToken } from './verify-2fa-token';

type EnableTwoFactorAuthenticationOptions = {
  user: Pick<User, 'id' | 'email' | 'twoFactorEnabled' | 'twoFactorSecret'>;
  code: string;
  requestMetadata?: RequestMetadata;
};

export const enableTwoFactorAuthentication = async ({
  user,
  code,
  requestMetadata,
}: EnableTwoFactorAuthenticationOptions) => {
  if (user.twoFactorEnabled) {
    throw new AppError('TWO_FACTOR_ALREADY_ENABLED');
  }

  if (!user.twoFactorSecret) {
    throw new AppError('TWO_FACTOR_SETUP_REQUIRED');
  }

  const isValidToken = await verifyTwoFactorAuthenticationToken({ user, totpCode: code });

  if (!isValidToken) {
    throw new AppError('INCORRECT_TWO_FACTOR_CODE');
  }

  let recoveryCodes: string[] = [];

  await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        twoFactorEnabled: true,
      },
    });

    recoveryCodes = getBackupCodes({ user: updatedUser }) ?? [];

    if (recoveryCodes.length === 0) {
      throw new AppError('MISSING_BACKUP_CODE');
    }

    await tx.userSecurityAuditLog.create({
      data: {
        userId: user.id,
        type: UserSecurityAuditLogType.AUTH_2FA_ENABLE,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });
  });

  return { recoveryCodes };
};
