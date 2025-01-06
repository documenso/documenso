import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const AuthenticationErrorCode = {
  Unauthorized: 'UNAUTHORIZED',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  SessionNotFound: 'SESSION_NOT_FOUND',
  SessionExpired: 'SESSION_EXPIRED',
  InvalidToken: 'INVALID_TOKEN',
  MissingToken: 'MISSING_TOKEN',
} as const;

export type AuthenticationErrorCode =
  // eslint-disable-next-line @typescript-eslint/ban-types
  (typeof AuthenticationErrorCode)[keyof typeof AuthenticationErrorCode] | (string & {});

export const ErrorStatusMap: Record<AuthenticationErrorCode, ContentfulStatusCode> = {
  [AuthenticationErrorCode.Unauthorized]: 401,
  [AuthenticationErrorCode.InvalidCredentials]: 401,
  [AuthenticationErrorCode.SessionNotFound]: 401,
  [AuthenticationErrorCode.SessionExpired]: 401,
  [AuthenticationErrorCode.InvalidToken]: 401,
  [AuthenticationErrorCode.MissingToken]: 400,
};

export function getErrorStatus(code: AuthenticationErrorCode) {
  return ErrorStatusMap[code] ?? 400;
}
