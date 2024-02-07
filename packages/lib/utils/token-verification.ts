import type { DurationLike } from 'luxon';
import { DateTime } from 'luxon';
import { nanoid } from 'nanoid';

/**
 * Create a token verification object.
 *
 * @param expiry The date the token expires, or the duration until the token expires.
 */
export const createTokenVerification = (expiry: Date | DurationLike) => {
  const expiresAt = expiry instanceof Date ? expiry : DateTime.now().plus(expiry).toJSDate();

  return {
    expiresAt,
    token: nanoid(32),
  };
};

export const isTokenExpired = (expiresAt: Date) => {
  return expiresAt < new Date();
};
