import { prisma } from '@documenso/prisma';

export const checkUserFromToken = async ({ token }: { token: string }) => {
  const user = await prisma.user.findFirst({
    where: {
      ApiToken: {
        some: {
          token: token,
        },
      },
    },
    include: {
      ApiToken: true,
    },
  });

  if (!user) {
    throw new Error('Token not found');
  }

  const tokenObject = user.ApiToken.find((apiToken) => apiToken.token === token);

  if (!tokenObject || new Date(tokenObject.expires) < new Date()) {
    throw new Error('The API token has expired');
  }

  return user;
};
