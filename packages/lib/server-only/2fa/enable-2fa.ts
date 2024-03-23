import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { type User, UserSecurityAuditLogType } from '@documenso/prisma/client';

import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getBackupCodes } from './get-backup-code';
import { verifyTwoFactorAuthenticationToken } from './verify-2fa-token';

type EnableTwoFactorAuthenticationOptions = {
  user: User;
  code: string;
  requestMetadata?: RequestMetadata;
};

export const enableTwoFactorAuthentication = async ({
  user,
  code,
  requestMetadata,
}: EnableTwoFactorAuthenticationOptions) => {
  if (user.twoFactorEnabled) {
    throw new Error(ErrorCode.TWO_FACTOR_ALREADY_ENABLED);
  }

  if (!user.twoFactorSecret) {
    throw new Error(ErrorCode.TWO_FACTOR_SETUP_REQUIRED);
  }

  const isValidToken = await verifyTwoFactorAuthenticationToken({ user, totpCode: code });

  if (!isValidToken) {
    throw new Error(ErrorCode.INCORRECT_TWO_FACTOR_CODE);
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
      throw new Error(ErrorCode.MISSING_BACKUP_CODE);
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
