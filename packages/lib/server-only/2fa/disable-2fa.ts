import { prisma } from '@documenso/prisma';
import type { User } from '@documenso/prisma/client';
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { validateTwoFactorAuthentication } from './validate-2fa';

type DisableTwoFactorAuthenticationOptions = {
  user: User;
  totpCode?: string;
  backupCode?: string;
  requestMetadata?: RequestMetadata;
};

export const disableTwoFactorAuthentication = async ({
  totpCode,
  backupCode,
  user,
  requestMetadata,
}: DisableTwoFactorAuthenticationOptions) => {
  let isValid = false;

  if (!totpCode && !backupCode) {
    throw new AppError(AppErrorCode.INVALID_REQUEST);
  }

  if (totpCode) {
    isValid = await validateTwoFactorAuthentication({ totpCode, user });
  } else if (backupCode) {
    isValid = await validateTwoFactorAuthentication({ backupCode, user });
  }

  if (!isValid) {
    throw new AppError('INCORRECT_TWO_FACTOR_CODE');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        twoFactorEnabled: false,
        twoFactorBackupCodes: null,
        twoFactorSecret: null,
      },
    });

    await tx.userSecurityAuditLog.create({
      data: {
        userId: user.id,
        type: UserSecurityAuditLogType.AUTH_2FA_DISABLE,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });
  });

  return true;
};
