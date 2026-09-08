import { formatSecureCookieName } from '@documenso/lib/constants/auth';
import { AppError } from '@documenso/lib/errors/app-error';
import type { TTwoFactorChallengeAction, TTwoFactorChallengeMetadata } from '@documenso/lib/types/two-factor-challenge';
import { ZTwoFactorChallengeMetadataSchema } from '@documenso/lib/types/two-factor-challenge';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  isChallengeExpired,
  shouldConsumeChallengeAfterFailure,
  TWO_FACTOR_CHALLENGE_LIFETIME_MS,
  TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS,
  TWO_FACTOR_CHALLENGE_TOKEN_IDENTIFIER,
} from '@documenso/lib/utils/two-factor-challenge';
import { prisma } from '@documenso/prisma';
import type { Prisma } from '@prisma/client';
import { UserSecurityAuditLogType } from '@prisma/client';
import crypto from 'crypto';
import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';

import { AuthenticationErrorCode } from '../errors/error-codes';
import { getAuthSecret, sessionCookieOptions } from '../session/session-cookies';

/**
 * Pending 2FA challenge plumbing for sign-in flows where the second factor
 * arrives in a later request than primary authentication (OAuth/OIDC
 * callbacks).
 *
 * The challenge is a random token stored in `VerificationToken` plus a signed
 * HttpOnly cookie carrying that token. The token is NOT a second factor — it
 * only carries "primary auth passed for user X" across the redirect, since no
 * session may exist before the TOTP/backup code is verified. Code
 * verification itself is the same `validateTwoFactorAuthentication` used by
 * the email/password flow.
 */

const twoFactorChallengeCookieName = formatSecureCookieName('twoFactorChallenge');

export type PendingTwoFactorChallenge = {
  id: number;
  userId: number;
  attempts: number;
  metadata: TTwoFactorChallengeMetadata;
};

export type CreateTwoFactorChallengeOptions = {
  userId: number;
  metadata: TTwoFactorChallengeMetadata;
};

/**
 * Issue a pending 2FA challenge for a user whose primary authentication has
 * succeeded, and attach the signed challenge cookie to the response.
 *
 * The metadata is round-tripped through the strict schema so an invalid
 * redirect path or a payload carrying unexpected keys (e.g. provider tokens)
 * can never be persisted.
 */
export const createTwoFactorChallenge = async (c: Context, options: CreateTwoFactorChallengeOptions): Promise<void> => {
  const metadata = ZTwoFactorChallengeMetadataSchema.parse(options.metadata);

  const token = crypto.randomBytes(32).toString('hex');

  await prisma.verificationToken.create({
    data: {
      identifier: TWO_FACTOR_CHALLENGE_TOKEN_IDENTIFIER,
      token,
      expires: new Date(Date.now() + TWO_FACTOR_CHALLENGE_LIFETIME_MS),
      metadata,
      userId: options.userId,
    },
  });

  await setSignedCookie(c, twoFactorChallengeCookieName, token, getAuthSecret(), {
    ...sessionCookieOptions,
    maxAge: Math.floor(TWO_FACTOR_CHALLENGE_LIFETIME_MS / 1000),
  });
};

export const clearTwoFactorChallengeCookie = (c: Context): void => {
  deleteCookie(c, twoFactorChallengeCookieName, sessionCookieOptions);
};

/**
 * Resolve the pending challenge for the current request, if any.
 *
 * Expired, exhausted, or malformed challenges are consumed and the cookie is
 * cleared — callers uniformly receive `null` and should tell the client to
 * restart sign-in.
 */
export const getPendingTwoFactorChallenge = async (c: Context): Promise<PendingTwoFactorChallenge | null> => {
  const token = await getSignedCookie(c, getAuthSecret(), twoFactorChallengeCookieName);

  if (!token) {
    return null;
  }

  const row = await prisma.verificationToken.findFirst({
    where: {
      token,
      identifier: TWO_FACTOR_CHALLENGE_TOKEN_IDENTIFIER,
    },
  });

  if (!row) {
    clearTwoFactorChallengeCookie(c);

    return null;
  }

  const metadataResult = ZTwoFactorChallengeMetadataSchema.safeParse(row.metadata);

  const isUsable =
    metadataResult.success &&
    !isChallengeExpired({ expiresAt: row.expires, now: new Date() }) &&
    !shouldConsumeChallengeAfterFailure(row.attempts);

  if (!isUsable) {
    // `deleteMany` so a concurrent consumption is a no-op instead of a P2025.
    await prisma.verificationToken.deleteMany({
      where: {
        id: row.id,
      },
    });

    clearTwoFactorChallengeCookie(c);

    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    attempts: row.attempts,
    metadata: metadataResult.data,
  };
};

export type RecordTwoFactorChallengeFailureOptions = {
  challenge: PendingTwoFactorChallenge;
  requestMetadata: RequestMetadata;
};

/**
 * Record a failed code attempt against a pending challenge.
 *
 * Failed codes do not consume the token but atomically increment its attempt
 * counter. The rate limiter fails open on DB errors, so this counter is the
 * hard bound on guesses per challenge — once it reaches the cap the challenge
 * is consumed and sign-in must restart.
 */
export const recordTwoFactorChallengeFailure = async (
  c: Context,
  { challenge, requestMetadata }: RecordTwoFactorChallengeFailureOptions,
): Promise<{ isExhausted: boolean }> => {
  // Conditional increment: only counts while under the cap so the counter
  // cannot be raced past it.
  const { count } = await prisma.verificationToken.updateMany({
    where: {
      id: challenge.id,
      attempts: {
        lt: TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS,
      },
    },
    data: {
      attempts: {
        increment: 1,
      },
    },
  });

  await prisma.userSecurityAuditLog.create({
    data: {
      userId: challenge.userId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      type: UserSecurityAuditLogType.SIGN_IN_2FA_FAIL,
    },
  });

  if (count === 0) {
    // Already at the cap (or deleted) via concurrent requests.
    await prisma.verificationToken.deleteMany({
      where: {
        id: challenge.id,
      },
    });

    clearTwoFactorChallengeCookie(c);

    return { isExhausted: true };
  }

  const updated = await prisma.verificationToken.findFirst({
    where: {
      id: challenge.id,
    },
    select: {
      attempts: true,
    },
  });

  const isExhausted = shouldConsumeChallengeAfterFailure(updated?.attempts ?? Number.MAX_SAFE_INTEGER);

  if (isExhausted) {
    await prisma.verificationToken.deleteMany({
      where: {
        id: challenge.id,
      },
    });

    clearTwoFactorChallengeCookie(c);
  }

  return { isExhausted };
};

/**
 * Consume a pending challenge on success.
 *
 * Uses `deleteMany` + count check so a concurrent replay of the same
 * challenge errors cleanly instead of surfacing a P2025 as a 500.
 */
export const consumeTwoFactorChallenge = async (tx: Prisma.TransactionClient, challengeId: number): Promise<void> => {
  const { count } = await tx.verificationToken.deleteMany({
    where: {
      id: challengeId,
    },
  });

  if (count === 0) {
    throw new AppError(AuthenticationErrorCode.TwoFactorChallengeExpired, {
      message: 'The two factor challenge has already been consumed.',
      statusCode: 401,
    });
  }
};

export type ExecuteTwoFactorChallengeActionOptions = {
  action: TTwoFactorChallengeAction;
  userId: number;
  requestMetadata: RequestMetadata;
};

/**
 * Execute the deferred OAuth account-link action after the code verified.
 *
 * The invariant this preserves: NO account mutation happens before the second
 * factor passes. The entire link transaction the OAuth callback would have
 * run inline (account row, email-verification/password clearing, link audit
 * log) is recreated here, in the same transaction as token consumption,
 * re-validating that the world has not changed since the callback.
 */
export const executeTwoFactorChallengeAction = async (
  tx: Prisma.TransactionClient,
  { action, userId, requestMetadata }: ExecuteTwoFactorChallengeActionOptions,
): Promise<void> => {
  const user = await tx.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      disabled: true,
    },
  });

  // Re-validate: the target user must still exist and must not be disabled.
  if (!user || user.disabled) {
    throw new AppError(AuthenticationErrorCode.AccountDisabled, {
      message: 'Account is not eligible for linking.',
      statusCode: 403,
    });
  }

  // Re-validate: the email must be unchanged since the OAuth callback — a
  // changed email means the provider account may no longer belong to this
  // user.
  if (user.email !== action.email) {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'Account email has changed since the sign-in was initiated.',
      statusCode: 400,
    });
  }

  const existingAccount = await tx.account.findFirst({
    where: {
      provider: action.provider,
      providerAccountId: action.providerAccountId,
    },
    select: {
      userId: true,
    },
  });

  // Re-validate: the provider account must not already be linked. Linked to
  // the same user is an idempotent no-op; linked to another user is a
  // conflict.
  if (existingAccount) {
    if (existingAccount.userId !== user.id) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest, {
        message: 'This provider account is already linked to another user.',
        statusCode: 400,
      });
    }

    return;
  }

  // The deferred account row is created WITHOUT access/ID tokens — they are
  // intentionally never stored in challenge metadata, so they are not
  // available here. This is deliberate: challenge metadata sits in the
  // database on the strength of primary auth alone.
  await tx.account.create({
    data: {
      type: 'oauth',
      provider: action.provider,
      providerAccountId: action.providerAccountId,
      userId: user.id,
    },
  });

  await tx.userSecurityAuditLog.create({
    data: {
      userId: user.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      type: UserSecurityAuditLogType.ACCOUNT_SSO_LINK,
    },
  });

  // Mirrors the inline OAuth link path: if the user was unverified, the OAuth
  // provider has now verified the email, and the password is removed since we
  // cannot confirm it was set by the real owner of the email.
  if (!user.emailVerified) {
    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: new Date(),
        password: null,
      },
    });
  }
};

/**
 * Best-effort cleanup used by `onAuthorize`: any successful sign-in clears a
 * pending challenge cookie and deletes its token — an abandoned challenge
 * must not outlive a login via another route.
 *
 * The challenge endpoint itself consumes its own token BEFORE calling
 * `onAuthorize`, so this sweep finds nothing to delete there and only clears
 * the (already superseded) cookie.
 */
export const sweepPendingTwoFactorChallenge = async (c: Context): Promise<void> => {
  try {
    const token = await getSignedCookie(c, getAuthSecret(), twoFactorChallengeCookieName);

    if (!token) {
      return;
    }

    await prisma.verificationToken.deleteMany({
      where: {
        token,
        identifier: TWO_FACTOR_CHALLENGE_TOKEN_IDENTIFIER,
      },
    });

    clearTwoFactorChallengeCookie(c);
  } catch {
    // A failed sweep must never block a successful sign-in.
  }
};
