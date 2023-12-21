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

  const tokenObject = user.ApiToken.find((apiToken) => apiToken.token === hashedToken);

  if (!tokenObject || new Date(tokenObject.expires) < new Date()) {
    throw new Error('Expired token');
  }

  return user;
};
