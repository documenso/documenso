export const TWO_FACTOR_CHALLENGE_TOKEN_IDENTIFIER = 'two-factor-challenge';

export const TWO_FACTOR_CHALLENGE_LIFETIME_MS = 10 * 60 * 1000;

// The rate limiter fails open on DB errors, so this is the hard bound on guesses
// per challenge.
export const TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS = 10;

/**
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

export const isChallengeExpired = (options: IsChallengeExpiredOptions): boolean => {
  const { expiresAt, now } = options;

  return now.getTime() >= expiresAt.getTime();
};
