import type { Context } from 'hono';

import { AppError } from '@documenso/lib/errors/app-error';

import { AuthenticationErrorCode } from '../errors/error-codes';
import type { SessionValidationResult } from '../session/session';
import { validateSessionToken } from '../session/session';
import { getSessionCookie } from '../session/session-cookies';

export const getSession = async (c: Context | Request): Promise<SessionValidationResult> => {
  // Todo: Make better
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

export const getRequiredSession = async (c: Context | Request) => {
  const { session, user } = await getSession(mapRequestToContextForCookie(c));

  if (session && user) {
    return { session, user };
  }

  // Todo: Test if throwing errors work
  if (c instanceof Request) {
    throw new Error('Unauthorized');
  }

  throw new AppError(AuthenticationErrorCode.Unauthorized);
};

const mapRequestToContextForCookie = (c: Context | Request) => {
  if (c instanceof Request) {
    // c.req.raw.headers.
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
