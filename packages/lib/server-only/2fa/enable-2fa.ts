import { prisma } from '@documenso/prisma';
import { type User, UserSecurityAuditLogType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getBackupCodes } from './get-backup-code';
import { verifyTwoFactorAuthenticationToken } from './verify-2fa-token';

type EnableTwoFactorAuthenticationOptions = {
  user: Pick<User, 'id' | 'email' | 'twoFactorEnabled' | 'twoFactorSecret'>;
  code: string;

  /**
   * Marked `twoFactorVerified` on success. Other sessions of the same user
   * intentionally stay unverified and must re-login.
   */
  sessionId: string;

  requestMetadata?: RequestMetadata;
};

export const enableTwoFactorAuthentication = async ({
  user,
  code,
  sessionId,
  requestMetadata,
}: EnableTwoFactorAuthenticationOptions) => {
  if (user.twoFactorEnabled) {
    throw new AppError('TWO_FACTOR_ALREADY_ENABLED');
  }

  if (!user.twoFactorSecret) {
    throw new AppError(AppErrorCode.TWO_FACTOR_SETUP_REQUIRED);
  }

  const isValidToken = await verifyTwoFactorAuthenticationToken({ user, totpCode: code });

  if (!isValidToken) {
    throw new AppError(AppErrorCode.INCORRECT_TWO_FACTOR_CODE);
  }

  let recoveryCodes: string[] = [];

  await prisma.$transaction(async (tx) => {
    // The write asserts the stored secret is the one the code was verified
    // against, so a concurrent setup-time secret rotation cannot enable 2FA with
    // an unverified secret.
    const { count } = await tx.user.updateMany({
      where: {
        id: user.id,
        twoFactorEnabled: false,
        twoFactorSecret: user.twoFactorSecret,
      },
      data: {
        twoFactorEnabled: true,
      },
    });

    if (count === 0) {
      throw new AppError('TWO_FACTOR_ALREADY_ENABLED', {
        message:
          'Two-factor authentication is already enabled, or the setup was restarted after this code was issued. Restart setup and try again.',
        statusCode: 400,
      });
    }

    const updatedUser = await tx.user.findFirst({
      where: {
        id: user.id,
      },
    });

    if (!updatedUser) {
      throw new AppError('MISSING_BACKUP_CODE');
    }

    recoveryCodes = getBackupCodes({ user: updatedUser }) ?? [];

    if (recoveryCodes.length === 0) {
      throw new AppError('MISSING_BACKUP_CODE');
    }

    await tx.session.updateMany({
      where: {
        id: sessionId,
        userId: user.id,
      },
      data: {
        twoFactorVerified: true,
      },
    });

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
