import { prisma } from '@documenso/prisma';

import { hashString } from '../auth/hash';

export const getUserByApiToken = async ({ token }: { token: string }) => {
  const hashedToken = hashString(token);

  const user = await prisma.user.findFirst({
    where: {
      ApiToken: {
        some: {
          token: hashedToken,
        },
      },
    },
    include: {
      ApiToken: true,
    },
  });

  if (!user) {
    throw new Error('Invalid token');
  }

  const retrievedToken = user.ApiToken.find((apiToken) => apiToken.token === hashedToken);

  // This should be impossible but we need to satisfy TypeScript
  if (!retrievedToken) {
    throw new Error('Invalid token');
  }

  if (retrievedToken.expires && retrievedToken.expires < new Date()) {
    throw new Error('Expired token');
  }

  return user;
};
