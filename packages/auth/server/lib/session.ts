import { prisma } from '@documenso/prisma';

import { AuthenticationErrorCode } from '../error-codes';
import { AuthenticationError } from '../errors';

export const getSession = async (token: string) => {
  const result = await prisma.session.findUnique({
    where: {
      sessionToken: token,
    },
    include: {
      user: true,
    },
  });

  if (!result) {
    throw new AuthenticationError(AuthenticationErrorCode.SessionNotFound);
  }

  if (result.expires < new Date()) {
    throw new AuthenticationError(AuthenticationErrorCode.SessionExpired);
  }

  const { user, ...session } = result;

  return {
    session,
    user,
  };
};
