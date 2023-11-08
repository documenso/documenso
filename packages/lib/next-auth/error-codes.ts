export const isErrorCode = (code: unknown): code is ErrorCode => {
  return typeof code === 'string' && code in ErrorCode;
};

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorCode = {
  INCORRECT_EMAIL_PASSWORD: 'INCORRECT_EMAIL_PASSWORD',
  USER_MISSING_PASSWORD: 'USER_MISSING_PASSWORD',
  CREDENTIALS_NOT_FOUND: 'CREDENTIALS_NOT_FOUND',
} as const;
