import { prisma } from '@documenso/prisma';
import type { User } from '@documenso/prisma/client';
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

import { AppError } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { validateTwoFactorAuthentication } from './validate-2fa';

type DisableTwoFactorAuthenticationOptions = {
  user: User;
  token: string;
  requestMetadata?: RequestMetadata;
};

export const disableTwoFactorAuthentication = async ({
  token,
  user,
  requestMetadata,
}: DisableTwoFactorAuthenticationOptions) => {
  let isValid = await validateTwoFactorAuthentication({ totpCode: token, user });

  if (!isValid) {
    isValid = await validateTwoFactorAuthentication({ backupCode: token, user });
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
