import { AppError } from '@documenso/lib/errors/app-error';
import { disableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/disable-2fa';
import { enableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/enable-2fa';
import { resetTwoFactorAfterBackupCodeUse } from '@documenso/lib/server-only/2fa/reset-2fa-after-backup-code-use';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';
import { validateTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/validate-2fa';
import { viewBackupCodes } from '@documenso/lib/server-only/2fa/view-backup-codes';
import { rateLimitResponse } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import {
  twoFactorChallengeIpRateLimit,
  twoFactorChallengeUserRateLimit,
} from '@documenso/lib/server-only/rate-limit/rate-limits';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { AuthenticationErrorCode } from '../lib/errors/error-codes';
import { getCsrfCookie } from '../lib/session/session-cookies';
import { onAuthorize } from '../lib/utils/authorizer';
import { getSession } from '../lib/utils/get-session';
import {
  clearTwoFactorChallengeCookie,
  consumeTwoFactorChallenge,
  executeTwoFactorChallengeAction,
  getPendingTwoFactorChallenge,
  recordTwoFactorChallengeFailure,
} from '../lib/utils/two-factor-challenge';
import type { HonoAuthContext } from '../types/context';
import {
  ZDisableTwoFactorRequestSchema,
  ZEnableTwoFactorRequestSchema,
  ZVerifyTwoFactorChallengeRequestSchema,
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

    const { user: sessionUser, session } = await getSession(c);

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
      sessionId: session.id,
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

    const { orgEnforcementApplies } = await disableTwoFactorAuthentication({
      user,
      totpCode,
      backupCode,
      requestMetadata,
    });

    // `orgEnforcementApplies` lets the client warn that org/team context
    // access will block at the org 2FA deadline (immediately if already
    // past). The disable itself is allowed — only instance enforcement
    // refuses it server-side.
    return c.json(
      {
        success: true,
        orgEnforcementApplies,
      },
      201,
    );
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
  })

  /**
   * Lightweight pending-challenge validity check for the /2fa-challenge page.
   *
   * Unauthenticated by design — the signed challenge cookie is the proof that
   * primary authentication passed. Resolving the challenge also garbage
   * collects expired/exhausted tokens, so an invalid state reports `false`
   * and the page sends the user back to sign-in.
   */
  .get('/challenge', async (c) => {
    const requestMetadata = c.get('requestMetadata');

    // IP-based limit before any challenge resolution.
    const ipLimitResult = await twoFactorChallengeIpRateLimit.check({
      ip: requestMetadata.ipAddress ?? 'unknown',
    });

    const ipLimited = rateLimitResponse(c, ipLimitResult);

    if (ipLimited) {
      throw new HTTPException(429, {
        res: ipLimited,
      });
    }

    const challenge = await getPendingTwoFactorChallenge(c);

    return c.json({
      valid: challenge !== null,
    });
  })

  /**
   * Verify the second factor for a pending 2FA challenge (OAuth/OIDC
   * sign-ins where the code arrives in a later request than primary auth).
   *
   * Unauthenticated by design: no session may exist before the code is
   * verified, so the signed HttpOnly challenge cookie is the proof of primary
   * authentication. The pending token is NOT a second factor itself — it only
   * carries "primary auth passed for user X" across the OAuth redirect; the
   * code is verified against the user's stored TOTP secret / backup codes via
   * `validateTwoFactorAuthentication`, identical to email/password login.
   *
   * No captcha here: this is the continuation of a sign-in that already
   * passed the provider's and our own abuse controls at the primary auth
   * step.
   */
  .post('/challenge', sValidator('json', ZVerifyTwoFactorChallengeRequestSchema), async (c) => {
    const requestMetadata = c.get('requestMetadata');

    const { totpCode, backupCode, csrfToken } = c.req.valid('json');

    // IP-based limit BEFORE challenge resolution so hammering without a valid
    // cookie never reaches the database token lookup.
    const ipLimitResult = await twoFactorChallengeIpRateLimit.check({
      ip: requestMetadata.ipAddress ?? 'unknown',
    });

    const ipLimited = rateLimitResponse(c, ipLimitResult);

    if (ipLimited) {
      throw new HTTPException(429, {
        res: ipLimited,
      });
    }

    const csrfCookieToken = await getCsrfCookie(c);

    if (!csrfCookieToken || csrfToken !== csrfCookieToken) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest, {
        message: 'Invalid CSRF token',
        statusCode: 400,
      });
    }

    const challenge = await getPendingTwoFactorChallenge(c);

    if (!challenge) {
      throw new AppError(AuthenticationErrorCode.TwoFactorChallengeExpired, {
        message: 'No pending two factor challenge. Restart the sign-in flow.',
        statusCode: 401,
      });
    }

    // Per-user limit only after the cookie resolved to a user.
    const userLimitResult = await twoFactorChallengeUserRateLimit.check({
      ip: requestMetadata.ipAddress ?? 'unknown',
      identifier: `user:${challenge.userId}`,
    });

    const userLimited = rateLimitResponse(c, userLimitResult);

    if (userLimited) {
      throw new HTTPException(429, {
        res: userLimited,
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: challenge.userId,
      },
      select: {
        id: true,
        email: true,
        disabled: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    // The challenge is moot if the user disappeared or no longer has 2FA
    // enabled — consume it and force a fresh sign-in.
    if (!user || !user.twoFactorEnabled) {
      await prisma.verificationToken.deleteMany({
        where: {
          id: challenge.id,
        },
      });

      clearTwoFactorChallengeCookie(c);

      throw new AppError(AuthenticationErrorCode.TwoFactorChallengeExpired, {
        message: 'The two factor challenge is no longer valid. Restart the sign-in flow.',
        statusCode: 401,
      });
    }

    // A rejected sign-in must never mutate the account, so a disabled user is
    // refused BEFORE code validation — otherwise a valid backup code would
    // run the recovery reset (stripping 2FA) even though `onAuthorize` would
    // refuse the session afterwards. The challenge is consumed so it cannot
    // be retried.
    if (user.disabled) {
      await prisma.verificationToken.deleteMany({
        where: {
          id: challenge.id,
        },
      });

      clearTwoFactorChallengeCookie(c);

      throw new AppError(AuthenticationErrorCode.AccountDisabled, {
        message: 'Account disabled',
        statusCode: 403,
      });
    }

    const validationResult = await validateTwoFactorAuthentication({
      totpCode,
      backupCode,
      user,
    });

    if (!validationResult.isValid) {
      // Failed codes do not consume the token but atomically increment its
      // attempt counter (audit-logged). The rate limiter fails open on DB
      // errors, so the counter is the hard bound — exhaustion consumes the
      // challenge.
      const { isExhausted } = await recordTwoFactorChallengeFailure(c, {
        challenge,
        requestMetadata,
      });

      if (isExhausted) {
        throw new AppError(AuthenticationErrorCode.TwoFactorChallengeExpired, {
          message: 'Too many failed attempts. Restart the sign-in flow.',
          statusCode: 401,
        });
      }

      throw new AppError(AuthenticationErrorCode.InvalidTwoFactorCode, {
        message: 'Invalid two factor code',
        statusCode: 400,
      });
    }

    const isBackupCodeRecovery = validationResult.method === 'backup';

    // Token consumption, the deferred link action (if any) and the
    // backup-code recovery reset all commit atomically — a concurrent replay
    // of the same challenge fails the consumption count check cleanly.
    await prisma.$transaction(async (tx) => {
      await consumeTwoFactorChallenge(tx, challenge.id);

      if (challenge.metadata.action) {
        await executeTwoFactorChallengeAction(tx, {
          action: challenge.metadata.action,
          userId: challenge.userId,
          requestMetadata,
        });
      }

      // Backup codes are recovery, not sign-in: a successful backup-code
      // challenge atomically resets 2FA so the user re-enrols.
      if (isBackupCodeRecovery) {
        await resetTwoFactorAfterBackupCodeUse({
          user,
          requestMetadata,
          tx,
        });
      }
    });

    // The session is created with the primary auth method stored at challenge
    // creation, and counts as second-factor verified.
    await onAuthorize(
      {
        userId: challenge.userId,
        authMethod: challenge.metadata.authMethod,
        twoFactorVerified: true,
      },
      c,
    );

    clearTwoFactorChallengeCookie(c);

    // A backup-code recovery lands on the re-enrolment page, carrying the
    // original destination as its returnTo.
    const redirectPath = isBackupCodeRecovery
      ? `/onboarding/2fa?returnTo=${encodeURIComponent(challenge.metadata.redirectPath)}`
      : challenge.metadata.redirectPath;

    return c.json(
      {
        redirectPath,
      },
      201,
    );
  });
