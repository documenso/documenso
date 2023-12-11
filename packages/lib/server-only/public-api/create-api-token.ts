import crypto from 'crypto';

import { prisma } from '@documenso/prisma';

// temporary choice for testing only
import { ONE_YEAR } from '../../constants/time';

type CreateApiTokenInput = {
  userId: number;
  tokenName: string;
};

export const createApiToken = async ({ userId, tokenName }: CreateApiTokenInput) => {
  // quick implementation for testing; it needs double checking
  const tokenHash = crypto
    .createHash('sha512')
    .update(crypto.randomBytes(32).toString('hex'))
    .digest('hex');

  const token = await prisma.apiToken.create({
    data: {
      token: tokenHash,
      name: tokenName,
      userId,
      expires: new Date(Date.now() + ONE_YEAR),
    },
  });

  if (!token) {
    throw new Error(`Failed to create the API token`);
  }

  return token;
};
