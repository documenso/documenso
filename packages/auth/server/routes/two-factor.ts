import { AppError } from '@documenso/lib/errors/app-error';
import { disableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/disable-2fa';
import { enableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/enable-2fa';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';
import { validateTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/validate-2fa';
import { viewBackupCodes } from '@documenso/lib/server-only/2fa/view-backup-codes';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import { UserSecurityAuditLogType } from '@prisma/client';
import { Hono } from 'hono';

import { AuthenticationErrorCode } from '../lib/errors/error-codes';
import { deletePendingTwoFactorCookie, getPendingTwoFactorUserId } from '../lib/session/pending-2fa';
import { onAuthorize } from '../lib/utils/authorizer';
import { getSession } from '../lib/utils/get-session';
import type { HonoAuthContext } from '../types/context';
import {
  ZCompleteOAuthTwoFactorRequestSchema,
  ZDisableTwoFactorRequestSchema,
  ZEnableTwoFactorRequestSchema,
  ZViewTwoFactorRecoveryCodesRequestSchema,
} from './two-factor.types';

export const twoFactorRoute = new Hono<HonoAuthContext>()
  /**
   * Complete an OAuth sign in that was paused for a second factor.
   *
   * The OAuth callback sets a signed `pending2fa` cookie instead of a session
   * when the account has 2FA enabled. This endpoint consumes that cookie,
   * validates the TOTP / backup code and only then issues the session.
   */
  .post('/complete-oauth', sValidator('json', ZCompleteOAuthTwoFactorRequestSchema), async (c) => {
    const requestMetadata = c.get('requestMetadata');

    const userId = await getPendingTwoFactorUserId(c);

    if (!userId) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest, {
        message: 'No pending two factor authentication found',
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user || !user.twoFactorEnabled) {
      await deletePendingTwoFactorCookie(c);

      throw new AppError(AuthenticationErrorCode.InvalidRequest, {
        message: 'No pending two factor authentication found',
      });
    }

    const { totpCode, backupCode } = c.req.valid('json');

    const isValid = await validateTwoFactorAuthentication({
      user,
      totpCode,
      backupCode,
    });

    if (!isValid) {
      await prisma.userSecurityAuditLog.create({
        data: {
          userId: user.id,
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
          type: UserSecurityAuditLogType.SIGN_IN_2FA_FAIL,
        },
      });

      throw new AppError(AuthenticationErrorCode.InvalidTwoFactorCode);
    }

    // Second factor satisfied: clear the pending marker and issue the session.
    await deletePendingTwoFactorCookie(c);

    await onAuthorize({ userId: user.id }, c);

    return c.text('OK', 201);
  })

  /**
   * Setup two factor authentication.
   */
  .post('/setup', async (c) => {
    const { user } = await getSession(c);

    const result = await setupTwoFactorAuthentication({
      user,
    });

    return c.json({
      success: true,
      secret: result.secret,
      uri: result.uri,
    });
  })

  /**
   * Enable two factor authentication.
   */
  .post('/enable', sValidator('json', ZEnableTwoFactorRequestSchema), async (c) => {
    const requestMetadata = c.get('requestMetadata');

    const { user: sessionUser } = await getSession(c);

    const user = await prisma.user.findFirst({
      where: {
        id: sessionUser.id,
      },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest);
    }

    const { code } = c.req.valid('json');

    const result = await enableTwoFactorAuthentication({
      user,
      code,
      requestMetadata,
    });

    return c.json({
      success: true,
      recoveryCodes: result.recoveryCodes,
    });
  })

  /**
   * Disable two factor authentication.
   */
  .post('/disable', sValidator('json', ZDisableTwoFactorRequestSchema), async (c) => {
    const requestMetadata = c.get('requestMetadata');

    const { user: sessionUser } = await getSession(c);

    const user = await prisma.user.findFirst({
      where: {
        id: sessionUser.id,
      },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest);
    }

    const { totpCode, backupCode } = c.req.valid('json');

    await disableTwoFactorAuthentication({
      user,
      totpCode,
      backupCode,
      requestMetadata,
    });

    return c.text('OK', 201);
  })

  /**
   * View backup codes.
   */
  .post('/view-recovery-codes', sValidator('json', ZViewTwoFactorRecoveryCodesRequestSchema), async (c) => {
    const { user: sessionUser } = await getSession(c);

    const user = await prisma.user.findFirst({
      where: {
        id: sessionUser.id,
      },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest);
    }

    const { token } = c.req.valid('json');

    const backupCodes = await viewBackupCodes({
      user,
      token,
    });

    return c.json({
      success: true,
      backupCodes,
    });
  });
