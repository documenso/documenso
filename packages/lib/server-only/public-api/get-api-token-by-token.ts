import { prisma } from '@documenso/prisma';

import { hashString } from '../auth/hash';

export const getApiTokenByToken = async ({ token }: { token: string }) => {
  const hashedToken = hashString(token);

  const apiToken = await prisma.apiToken.findFirst({
    where: {
      token: hashedToken,
    },
    include: {
      team: true,
      user: true,
    },
  });

  if (!apiToken) {
    throw new Error('Invalid token');
  }

  if (apiToken.expires && apiToken.expires < new Date()) {
    throw new Error('Expired token');
  }

  // Handle a silly choice from many moons ago
  if (apiToken.team && !apiToken.user) {
    apiToken.user = await prisma.user.findFirst({
      where: {
        id: apiToken.team.ownerUserId,
      },
    });
  }

  const { user } = apiToken;

  // This will never happen but we need to narrow types
  if (!user) {
    throw new Error('Invalid token');
  }

  return {
    ...apiToken,
    user,
  };
};
