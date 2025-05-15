import type { Context } from 'hono';

import { AppError } from '@documenso/lib/errors/app-error';

import { AuthenticationErrorCode } from '../errors/error-codes';
import type { SessionValidationResult } from '../session/session';
import { validateSessionToken } from '../session/session';
import { getSessionCookie } from '../session/session-cookies';

export const getSession = async (c: Context | Request) => {
  const { session, user } = await getOptionalSession(mapRequestToContextForCookie(c));

  if (session && user) {
    return { session, user };
  }

  if (c instanceof Request) {
    throw new Error('Unauthorized');
  }

  throw new AppError(AuthenticationErrorCode.Unauthorized);
};

export const getOptionalSession = async (
  c: Context | Request,
): Promise<SessionValidationResult> => {
  const sessionId = await getSessionCookie(mapRequestToContextForCookie(c));

  if (!sessionId) {
    return {
      isAuthenticated: false,
      session: null,
      user: null,
    };
  }

  return await validateSessionToken(sessionId);
};

/**
 * Todo: (RR7) Rethink, this is pretty sketchy.
 */
const mapRequestToContextForCookie = (c: Context | Request) => {
  if (c instanceof Request) {
    const partialContext = {
      req: {
        raw: c,
      },
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return partialContext as unknown as Context;
  }

  return c;
};
