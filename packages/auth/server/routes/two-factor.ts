import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';

import { AppError } from '@documenso/lib/errors/app-error';
import { disableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/disable-2fa';
import { enableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/enable-2fa';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';
import { viewBackupCodes } from '@documenso/lib/server-only/2fa/view-backup-codes';
import { prisma } from '@documenso/prisma';

import { AuthenticationErrorCode } from '../lib/errors/error-codes';
import { getSession } from '../lib/utils/get-session';
import type { HonoAuthContext } from '../types/context';
import {
  ZDisableTwoFactorRequestSchema,
  ZEnableTwoFactorRequestSchema,
  ZViewTwoFactorRecoveryCodesRequestSchema,
} from './two-factor.types';

export const twoFactorRoute = new Hono<HonoAuthContext>()
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
  .post(
    '/view-recovery-codes',
    sValidator('json', ZViewTwoFactorRecoveryCodesRequestSchema),
    async (c) => {
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
    },
  );
