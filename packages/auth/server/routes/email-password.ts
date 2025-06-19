import { sValidator } from '@hono/standard-validator';
import { compare } from '@node-rs/bcrypt';
import { UserSecurityAuditLogType } from '@prisma/client';
import { Hono } from 'hono';
import { DateTime } from 'luxon';
import { z } from 'zod';

import { EMAIL_VERIFICATION_STATE } from '@documenso/lib/constants/email';
import { AppError } from '@documenso/lib/errors/app-error';
import { jobsClient } from '@documenso/lib/jobs/client';
import { disableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/disable-2fa';
import { enableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/enable-2fa';
import { isTwoFactorAuthenticationEnabled } from '@documenso/lib/server-only/2fa/is-2fa-availble';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';
import { validateTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/validate-2fa';
import { viewBackupCodes } from '@documenso/lib/server-only/2fa/view-backup-codes';
import { createUser } from '@documenso/lib/server-only/user/create-user';
import { forgotPassword } from '@documenso/lib/server-only/user/forgot-password';
import { getMostRecentVerificationTokenByUserId } from '@documenso/lib/server-only/user/get-most-recent-verification-token-by-user-id';
import { resetPassword } from '@documenso/lib/server-only/user/reset-password';
import { updatePassword } from '@documenso/lib/server-only/user/update-password';
import { verifyEmail } from '@documenso/lib/server-only/user/verify-email';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

import { AuthenticationErrorCode } from '../lib/errors/error-codes';
import { getCsrfCookie } from '../lib/session/session-cookies';
import { onAuthorize } from '../lib/utils/authorizer';
import { getSession } from '../lib/utils/get-session';
import type { HonoAuthContext } from '../types/context';
import {
  ZForgotPasswordSchema,
  ZResendVerifyEmailSchema,
  ZResetPasswordSchema,
  ZSignInSchema,
  ZSignUpSchema,
  ZUpdatePasswordSchema,
  ZVerifyEmailSchema,
} from '../types/email-password';

export const emailPasswordRoute = new Hono<HonoAuthContext>()
  /**
   * Authorize endpoint.
   */
  .post('/authorize', sValidator('json', ZSignInSchema), async (c) => {
    const requestMetadata = c.get('requestMetadata');

    const { email, password, totpCode, backupCode, csrfToken } = c.req.valid('json');

    const csrfCookieToken = await getCsrfCookie(c);

    // Todo: (RR7) Add logging here.
    if (csrfToken !== csrfCookieToken || !csrfCookieToken) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest, {
        message: 'Invalid CSRF token',
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!user || !user.password) {
      throw new AppError(AuthenticationErrorCode.InvalidCredentials, {
        message: 'Invalid email or password',
      });
    }

    const isPasswordsSame = await compare(password, user.password);

    if (!isPasswordsSame) {
      await prisma.userSecurityAuditLog.create({
        data: {
          userId: user.id,
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
          type: UserSecurityAuditLogType.SIGN_IN_FAIL,
        },
      });

      throw new AppError(AuthenticationErrorCode.InvalidCredentials, {
        message: 'Invalid email or password',
      });
    }

    const is2faEnabled = isTwoFactorAuthenticationEnabled({ user });

    if (is2faEnabled) {
      const isValid = await validateTwoFactorAuthentication({ backupCode, totpCode, user });

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
    }

    if (!user.emailVerified) {
      const mostRecentToken = await getMostRecentVerificationTokenByUserId({
        userId: user.id,
      });

      if (
        !mostRecentToken ||
        mostRecentToken.expires.valueOf() <= Date.now() ||
        DateTime.fromJSDate(mostRecentToken.createdAt).diffNow('minutes').minutes > -5
      ) {
        await jobsClient.triggerJob({
          name: 'send.signup.confirmation.email',
          payload: {
            email: user.email,
          },
        });
      }

      throw new AppError('UNVERIFIED_EMAIL', {
        message: 'Unverified email',
      });
    }

    if (user.disabled) {
      throw new AppError('ACCOUNT_DISABLED', {
        message: 'Account disabled',
      });
    }

    await onAuthorize({ userId: user.id }, c);

    return c.text('', 201);
  })
  /**
   * Signup endpoint.
   */
  .post('/signup', sValidator('json', ZSignUpSchema), async (c) => {
    if (env('NEXT_PUBLIC_DISABLE_SIGNUP') === 'true') {
      throw new AppError('SIGNUP_DISABLED', {
        message: 'Signups are disabled.',
      });
    }

    const { name, email, password, signature } = c.req.valid('json');

    const user = await createUser({ name, email, password, signature }).catch((err) => {
      console.error(err);
      throw err;
    });

    await jobsClient.triggerJob({
      name: 'send.signup.confirmation.email',
      payload: {
        email: user.email,
      },
    });

    return c.text('OK', 201);
  })
  /**
   * Update password endpoint.
   */
  .post('/update-password', sValidator('json', ZUpdatePasswordSchema), async (c) => {
    const { password, currentPassword } = c.req.valid('json');
    const requestMetadata = c.get('requestMetadata');

    const session = await getSession(c);

    await updatePassword({
      userId: session.user.id,
      password,
      currentPassword,
      requestMetadata,
    });

    return c.text('OK', 201);
  })
  /**
   * Verify email endpoint.
   */
  .post('/verify-email', sValidator('json', ZVerifyEmailSchema), async (c) => {
    const { state, userId } = await verifyEmail({ token: c.req.valid('json').token });

    // If email is verified, automatically authenticate user.
    if (state === EMAIL_VERIFICATION_STATE.VERIFIED && userId !== null) {
      await onAuthorize({ userId }, c);
    }

    return c.json({
      state,
    });
  })
  /**
   * Resend verification email endpoint.
   */
  .post('/resend-verify-email', sValidator('json', ZResendVerifyEmailSchema), async (c) => {
    const { email } = c.req.valid('json');

    await jobsClient.triggerJob({
      name: 'send.signup.confirmation.email',
      payload: {
        email,
      },
    });

    return c.text('OK', 201);
  })
  /**
   * Forgot password endpoint.
   */
  .post('/forgot-password', sValidator('json', ZForgotPasswordSchema), async (c) => {
    const { email } = c.req.valid('json');

    await forgotPassword({
      email,
    });

    return c.text('OK', 201);
  })
  /**
   * Reset password endpoint.
   */
  .post('/reset-password', sValidator('json', ZResetPasswordSchema), async (c) => {
    const { token, password } = c.req.valid('json');

    const requestMetadata = c.get('requestMetadata');

    await resetPassword({
      token,
      password,
      requestMetadata,
    });

    return c.text('OK', 201);
  })
  /**
   * Setup two factor authentication.
   */
  .post('/2fa/setup', async (c) => {
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
  .post(
    '/2fa/enable',
    sValidator(
      'json',
      z.object({
        code: z.string(),
      }),
    ),
    async (c) => {
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
    },
  )
  /**
   * Disable two factor authentication.
   */
  .post(
    '/2fa/disable',
    sValidator(
      'json',
      z.object({
        totpCode: z.string().trim().optional(),
        backupCode: z.string().trim().optional(),
      }),
    ),
    async (c) => {
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
    },
  )
  /**
   * View backup codes.
   */
  .post(
    '/2fa/view-recovery-codes',
    sValidator(
      'json',
      z.object({
        token: z.string(),
      }),
    ),
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
