import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { hashString } from '../auth/hash';

export const getApiTokenByToken = async ({ token }: { token: string }) => {
  const hashedToken = hashString(token);

  const apiToken = await prisma.apiToken.findFirst({
    where: {
      token: hashedToken,
    },
    include: {
      team: {
        include: {
          organisation: {
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  disabled: true,
                },
              },
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          disabled: true,
        },
      },
    },
  });

  if (!apiToken) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  if (apiToken.expires && apiToken.expires < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, {
      message: 'Expired token',
      statusCode: 401,
    });
  }

  // Handle a silly choice from many moons ago
  if (apiToken.team && !apiToken.user) {
    apiToken.user = apiToken.team.organisation.owner;
  }

  const { user } = apiToken;

  // This will never happen but we need to narrow types
  if (!user) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  return {
    ...apiToken,
    user,
  };
};
