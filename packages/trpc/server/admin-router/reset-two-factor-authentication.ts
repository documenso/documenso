import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import { UserSecurityAuditLogType } from '@prisma/client';

import { adminProcedure } from '../trpc';
import { ZResetTwoFactorRequestSchema, ZResetTwoFactorResponseSchema } from './reset-two-factor-authentication.types';

export const resetTwoFactorRoute = adminProcedure
  .input(ZResetTwoFactorRequestSchema)
  .output(ZResetTwoFactorResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId } = input;

    ctx.logger.info({
      input: {
        userId,
      },
    });

    return await resetTwoFactor({
      userId,
      actorUserId: ctx.user.id,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  });

export type ResetTwoFactorOptions = {
  userId: number;

  actorUserId: number;

  requestMetadata?: RequestMetadata;
};

/**
 * Self-reset is forbidden so an admin cannot quietly restart their own grace
 * window. A reset also extends org grace across a trust boundary (instance
 * admin → org policy), hence the `AUTH_2FA_ADMIN_RESET` audit log entry.
 */
export const resetTwoFactor = async ({ userId, actorUserId, requestMetadata }: ResetTwoFactorOptions) => {
  if (userId === actorUserId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You cannot reset your own two factor authentication',
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'User not found' });
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
        // Without restarting the grace window a reset under active enforcement
        // would instantly block the user.
        twoFactorGraceStartedAt: new Date(),
      },
    });

    await tx.userSecurityAuditLog.create({
      data: {
        userId: user.id,
        type: UserSecurityAuditLogType.AUTH_2FA_ADMIN_RESET,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });
  });
};
