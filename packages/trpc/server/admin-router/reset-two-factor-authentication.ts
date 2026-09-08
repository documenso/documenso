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

  /**
   * The acting admin. Self-reset is forbidden — an admin who loses their
   * authenticator goes through the normal recovery paths instead of quietly
   * restarting their own grace window.
   */
  actorUserId: number;

  requestMetadata?: RequestMetadata;
};

/**
 * Admin reset of a user's 2FA configuration.
 *
 * Also restarts the user's grace window (`twoFactorGraceStartedAt = now`) —
 * for BOTH instance and organisation enforcement, since the org deadline
 * anchors on this field too. Without the restart, a reset under active
 * enforcement would instantly block the user.
 *
 * Because a reset silently extends org grace across a trust boundary
 * (instance admin → org policy), it is made traceable via a
 * `AUTH_2FA_ADMIN_RESET` security audit log entry.
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
        // Restart the grace window: anchors both the instance deadline and,
        // through the org deadline's max-of-anchors, every org deadline.
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
