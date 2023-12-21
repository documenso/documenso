import { prisma } from '@documenso/prisma';

// temporary choice for testing only
import { ONE_YEAR } from '../../constants/time';
import { alphaid } from '../../universal/id';
import { hashString } from '../auth/hash';

type CreateApiTokenInput = {
  userId: number;
  tokenName: string;
};

export const createApiToken = async ({ userId, tokenName }: CreateApiTokenInput) => {
  const apiToken = `api_${alphaid(16)}`;

  const hashedToken = hashString(apiToken);

  const dbToken = await prisma.apiToken.create({
    data: {
      token: hashedToken,
      name: tokenName,
      userId,
      expires: new Date(Date.now() + ONE_YEAR),
    },
  });

  if (!dbToken) {
    throw new Error(`Failed to create the API token`);
  }

  return {
    id: dbToken.id,
    token: apiToken,
  };
};
