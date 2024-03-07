import { compare } from '@node-rs/bcrypt';

import { prisma } from '@documenso/prisma';
import type { User } from '@documenso/prisma/client';
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

import { ErrorCode } from '../../next-auth/error-codes';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { validateTwoFactorAuthentication } from './validate-2fa';

type DisableTwoFactorAuthenticationOptions = {
  user: User;
  backupCode: string;
  password: string;
  requestMetadata?: RequestMetadata;
};

export const disableTwoFactorAuthentication = async ({
  backupCode,
  user,
  password,
  requestMetadata,
}: DisableTwoFactorAuthenticationOptions) => {
  if (!user.password) {
    throw new Error(ErrorCode.USER_MISSING_PASSWORD);
  }

  const isCorrectPassword = await compare(password, user.password);

  if (!isCorrectPassword) {
    throw new Error(ErrorCode.INCORRECT_PASSWORD);
  }

  const isValid = await validateTwoFactorAuthentication({ backupCode, user });

  if (!isValid) {
    throw new Error(ErrorCode.INCORRECT_TWO_FACTOR_BACKUP_CODE);
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
