export const AuthenticationErrorCode = {
  AccountDisabled: 'ACCOUNT_DISABLED',
  Unauthorized: 'UNAUTHORIZED',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  SessionNotFound: 'SESSION_NOT_FOUND',
  SessionExpired: 'SESSION_EXPIRED',
  InvalidToken: 'INVALID_TOKEN',
  MissingToken: 'MISSING_TOKEN',
  InvalidRequest: 'INVALID_REQUEST',
  UnverifiedEmail: 'UNVERIFIED_EMAIL',
  NotFound: 'NOT_FOUND',
  NotSetup: 'NOT_SETUP',

  // InternalSeverError: 'INTERNAL_SEVER_ERROR',
  // TwoFactorAlreadyEnabled: 'TWO_FACTOR_ALREADY_ENABLED',
  // TwoFactorSetupRequired: 'TWO_FACTOR_SETUP_REQUIRED',
  // TwoFactorMissingSecret: 'TWO_FACTOR_MISSING_SECRET',
  // TwoFactorMissingCredentials: 'TWO_FACTOR_MISSING_CREDENTIALS',
  InvalidTwoFactorCode: 'INVALID_TWO_FACTOR_CODE',
  // A pending 2FA challenge is missing, expired, or exhausted — the client
  // must restart the sign-in flow.
  TwoFactorChallengeExpired: 'TWO_FACTOR_CHALLENGE_EXPIRED',
  SigninDisabled: 'SIGNIN_DISABLED',
  SignupDisabled: 'SIGNUP_DISABLED',
  SignupDisposableEmail: 'SIGNUP_DISPOSABLE_EMAIL',
  // IncorrectTwoFactorBackupCode: 'INCORRECT_TWO_FACTOR_BACKUP_CODE',
  // IncorrectIdentityProvider: 'INCORRECT_IDENTITY_PROVIDER',
  // IncorrectPassword: 'INCORRECT_PASSWORD',
  // MissingEncryptionKey: 'MISSING_ENCRYPTION_KEY',
  // MissingBackupCode: 'MISSING_BACKUP_CODE',
} as const;

export type AuthenticationErrorCode =
  // eslint-disable-next-line @typescript-eslint/ban-types
  (typeof AuthenticationErrorCode)[keyof typeof AuthenticationErrorCode] | (string & {});
