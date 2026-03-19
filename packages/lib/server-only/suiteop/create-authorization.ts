import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

import { alphaid } from '../../universal/id';
import { createApiToken } from '../public-api/create-api-token';

export type CreateAuthorizationOptions = {
  userId: number;
  teamId: number;
  state?: string;
};

export const createAuthorization = async ({
  userId,
  teamId,
  state,
}: CreateAuthorizationOptions) => {
  // Create API token for the team
  const { id: apiTokenId, token } = await createApiToken({
    userId,
    teamId,
    tokenName: 'SuiteOp Integration',
    expiresIn: null, // Permanent token
  });

  // Generate claim code
  const claimCode = `claim_${alphaid(24)}`;

  // Create authorization record with plaintext token (temporary until claimed)
  const authorization = await prisma.suiteOpAuthorization.create({
    data: {
      claimCode,
      expiresAt: DateTime.now().plus({ minutes: 15 }).toJSDate(),
      userId,
      teamId,
      apiTokenId,
      plaintextToken: token, // Store plaintext token temporarily
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    claimCode,
    state,
    team: authorization.team,
  };
};
