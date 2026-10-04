import { formatSecureCookieName, getCookieDomain, useSecureCookies } from '@documenso/lib/constants/auth';
import { env } from '@documenso/lib/utils/env';
import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';

/**
 * Lifetime of the pending 2FA cookie.
 *
 * Kept intentionally short: it only needs to survive the round trip between
 * the OAuth callback and the user typing their TOTP code.
 */
const PENDING_2FA_LIFETIME_MS = 5 * 60 * 1000;

export const pendingTwoFactorCookieName = formatSecureCookieName('pending2fa');

const getAuthSecret = () => {
  const authSecret = env('NEXTAUTH_SECRET');

  if (!authSecret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }

  return authSecret;
};

const pendingTwoFactorCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: useSecureCookies ? 'none' : 'lax',
  secure: useSecureCookies,
  domain: getCookieDomain(),
} as const;

/**
 * Marks a user as having completed the first factor (OAuth) but still owing a
 * second factor (TOTP / backup code) before a session may be issued.
 *
 * The value is the user id. It is signed so it cannot be forged by a client
 * attempting to skip the second factor.
 */
export const setPendingTwoFactorCookie = async (c: Context, userId: number) => {
  await setSignedCookie(c, pendingTwoFactorCookieName, String(userId), getAuthSecret(), {
    ...pendingTwoFactorCookieOptions,
    expires: new Date(Date.now() + PENDING_2FA_LIFETIME_MS),
  });
};

/**
 * Reads the pending 2FA user id, if any.
 *
 * @returns The user id awaiting a second factor, or null.
 */
export const getPendingTwoFactorUserId = async (c: Context): Promise<number | null> => {
  const value = await getSignedCookie(c, getAuthSecret(), pendingTwoFactorCookieName);

  if (!value) {
    return null;
  }

  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return userId;
};

export const deletePendingTwoFactorCookie = (c: Context) => {
  deleteCookie(c, pendingTwoFactorCookieName, pendingTwoFactorCookieOptions);
};
