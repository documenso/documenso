import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { hashString } from '../auth/hash';

export const getUserByApiToken = async ({ token }: { token: string }) => {
  const hashedToken = hashString(token);

  const user = await prisma.user.findFirst({
    where: {
      apiTokens: {
        some: {
          token: hashedToken,
        },
      },
    },
    include: {
      apiTokens: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  const retrievedToken = user.apiTokens.find((apiToken) => apiToken.token === hashedToken);

  // This should be impossible but we need to satisfy TypeScript
  if (!retrievedToken) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  if (retrievedToken.expires && retrievedToken.expires < new Date()) {
    throw new Error('Expired token');
  }

  return user;
};
