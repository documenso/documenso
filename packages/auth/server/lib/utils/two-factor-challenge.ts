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
 * The challenge token is NOT a second factor, it only carries "primary auth
 * passed for user X" across the OAuth redirect. No session may exist before the
 * TOTP/backup code is verified.
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
 * The rate limiter fails open on DB errors, so this counter is the hard bound
 * on guesses per challenge.
 */
export const recordTwoFactorChallengeFailure = async (
  c: Context,
  { challenge, requestMetadata }: RecordTwoFactorChallengeFailureOptions,
): Promise<{ isExhausted: boolean }> => {
  // Only increments while under the cap so the counter cannot be raced past it.
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
 * `deleteMany` + count check so a concurrent replay of the same challenge
 * errors cleanly instead of surfacing a P2025 as a 500.
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
 * Invariant: no account mutation happens before the second factor passes. The
 * link transaction the OAuth callback would have run inline is recreated here,
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

  if (!user || user.disabled) {
    throw new AppError(AuthenticationErrorCode.AccountDisabled, {
      message: 'Account is not eligible for linking.',
      statusCode: 403,
    });
  }

  // A changed email means the provider account may no longer belong to this
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

  if (existingAccount) {
    if (existingAccount.userId !== user.id) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest, {
        message: 'This provider account is already linked to another user.',
        statusCode: 400,
      });
    }

    return;
  }

  // Deliberately created without access/ID tokens: challenge metadata sits in
  // the database on the strength of primary auth alone.
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

  // Mirrors the inline OAuth link path: the password is removed since we cannot
  // confirm it was set by the real owner of the email.
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
