import { SALT_ROUNDS } from '@documenso/lib/constants/auth';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import { compare, hash } from '@node-rs/bcrypt';
import { UserSecurityAuditLogType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobsClient } from '../../jobs/client';
import { validateTwoFactorAuthentication } from '../2fa/validate-2fa';

export type UpdatePasswordOptions = {
  userId: number;
  password: string;
  currentPassword: string;
  totpCode?: string;
  backupCode?: string;
  requestMetadata?: RequestMetadata;
};

/**
 * Update the password for a user who already has one.
 *
 * Requires the current password, and a valid TOTP or backup code if the user
 * has two factor authentication enabled.
 */
export const updatePassword = async ({
  userId,
  password,
  currentPassword,
  totpCode,
  backupCode,
  requestMetadata,
}: UpdatePasswordOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      password: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user.password) {
    throw new AppError(AppErrorCode.NO_PASSWORD);
  }

  const isCurrentPasswordValid = await compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new AppError(AppErrorCode.INCORRECT_PASSWORD);
  }

  if (user.twoFactorEnabled) {
    if (!totpCode && !backupCode) {
      throw new AppError(AppErrorCode.TWO_FACTOR_MISSING_CREDENTIALS, { statusCode: 400 });
    }

    const isTwoFactorValid = await validateTwoFactorAuthentication({ user, totpCode, backupCode });

    if (!isTwoFactorValid) {
      throw new AppError(AppErrorCode.INCORRECT_TWO_FACTOR_CODE, { statusCode: 401 });
    }
  }

  // Compare the new password with the old password
  const isSamePassword = await compare(password, user.password);
  if (isSamePassword) {
    throw new AppError(AppErrorCode.SAME_PASSWORD);
  }

  const hashedNewPassword = await hash(password, SALT_ROUNDS);

  const updatedUser = await prisma.$transaction(async (tx) => {
    await tx.userSecurityAuditLog.create({
      data: {
        userId,
        type: UserSecurityAuditLogType.PASSWORD_UPDATE,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });

    await tx.passwordResetToken.deleteMany({
      where: {
        userId,
      },
    });

    return await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedNewPassword,
      },
    });
  });

  // Notify the user so a change made from a hijacked session does not go unnoticed.
  await jobsClient.triggerJob({
    name: 'send.password.reset.success.email',
    payload: {
      userId,
    },
  });

  return updatedUser;
};
