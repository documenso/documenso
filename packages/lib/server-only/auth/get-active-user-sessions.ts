import { prisma } from '@documenso/prisma';

interface GetActiveUserSessionsOptions {
  id: number;
}

export async function getActiveUserSessions({ id }: GetActiveUserSessionsOptions) {
  return await prisma.session.findMany({
    where: {
      userId: id,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
}
