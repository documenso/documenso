/**
 * Pure helpers for pending 2FA challenge tokens.
 *
 * Everything in this file must remain free of I/O so the challenge
 * consumption rules can be unit tested directly. The server-side
 * create/consume logic lives in `@documenso/auth`.
 */

/**
 * `VerificationToken.identifier` for pending 2FA challenge tokens.
 */
export const TWO_FACTOR_CHALLENGE_TOKEN_IDENTIFIER = 'two-factor-challenge';

/**
 * How long a pending challenge remains valid after primary auth passes.
 */
export const TWO_FACTOR_CHALLENGE_LIFETIME_MS = 10 * 60 * 1000;

/**
 * Failed code attempts before the challenge is consumed and the user must
 * restart sign-in.
 *
 * The rate limiter fails open on DB errors, so this counter — atomically
 * incremented on the token row itself — is the hard bound on guesses per
 * challenge.
 */
export const TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS = 10;

/**
 * Whether a challenge must be consumed after a failed attempt.
 *
 * @param attempts The attempt count AFTER the failed attempt was recorded.
 */
export const shouldConsumeChallengeAfterFailure = (
  attempts: number,
  maxAttempts: number = TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS,
): boolean => {
  return attempts >= maxAttempts;
};

export type IsChallengeExpiredOptions = {
  expiresAt: Date;
  now: Date;
};

/**
 * Whether a challenge has expired. The expiry instant itself counts as
 * expired (`now >= expiresAt`).
 */
export const isChallengeExpired = (options: IsChallengeExpiredOptions): boolean => {
  const { expiresAt, now } = options;

  return now.getTime() >= expiresAt.getTime();
};
