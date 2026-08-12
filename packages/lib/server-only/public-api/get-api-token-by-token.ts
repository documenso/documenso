import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { hashString } from '../auth/hash';
import { assertOrganisationRatesAndLimits } from '../rate-limit/assert-organisation-rates-and-limits';

type GetApiTokenByTokenOptions = {
  token: string;

  /**
   * Defaults to false.
   *
   * Will assert that the API request limit is not exceeded.
   */
  bypassRateLimit?: boolean;
};

export const getApiTokenByToken = async ({ token, bypassRateLimit = false }: GetApiTokenByTokenOptions) => {
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
              organisationClaim: true,
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

  if (apiToken.user?.disabled || apiToken.team.organisation.owner.disabled) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'User is disabled',
      statusCode: 401,
    });
  }

  if (apiToken.expires && apiToken.expires < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, {
      message: 'Expired token',
      statusCode: 401,
    });
  }

  if (!bypassRateLimit) {
    await assertOrganisationRatesAndLimits({
      organisationId: apiToken.team.organisationId,
      organisationClaim: apiToken.team.organisation.organisationClaim,
      type: 'api',
      count: 1,
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
