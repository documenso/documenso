import { prisma } from '@documenso/prisma';

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
    throw new Error('Invalid token');
  }

  const retrievedToken = user.apiTokens.find((apiToken) => apiToken.token === hashedToken);

  // This should be impossible but we need to satisfy TypeScript
  if (!retrievedToken) {
    throw new Error('Invalid token');
  }

  if (retrievedToken.expires && retrievedToken.expires < new Date()) {
    throw new Error('Expired token');
  }

  return user;
};
