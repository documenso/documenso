import type { Context } from 'hono';

import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import type { HonoAuthContext } from '../../types/context';
import { AuthenticationErrorCode } from '../errors/error-codes';
import { createSession, generateSessionToken } from '../session/session';
import { setSessionCookie } from '../session/session-cookies';

type AuthorizeUser = {
  userId: number;
};

/**
 * Handles creating a session.
 */
export const onAuthorize = async (user: AuthorizeUser, c: Context<HonoAuthContext>) => {
  const dbUser = await prisma.user.findFirst({
    where: { id: user.userId },
    select: { disabled: true },
  });

  if (!dbUser || dbUser.disabled) {
    throw new AppError(AuthenticationErrorCode.AccountDisabled, {
      message: 'Account disabled',
    });
  }

  const metadata = c.get('requestMetadata');

  const sessionToken = generateSessionToken();

  await createSession(sessionToken, user.userId, metadata);

  await setSessionCookie(c, sessionToken);
};
