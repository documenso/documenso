import { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

type getAllUsersProps = {
  username: string;
  email: string;
  page: number;
  perPage: number;
};

export const findUsers = async ({
  username = '',
  email = '',
  page = 1,
  perPage = 10,
}: getAllUsersProps) => {
  const whereClause = Prisma.validator<Prisma.UserWhereInput>()({
    OR: [
      {
        name: {
          contains: username,
          mode: 'insensitive',
        },
      },
      {
        email: {
          contains: email,
          mode: 'insensitive',
        },
      },
    ],
  });

  const [users, count] = await Promise.all([
    await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        Subscription: {
          select: {
            id: true,
            status: true,
            planId: true,
            priceId: true,
            createdAt: true,
            periodEnd: true,
          },
        },
        Document: {
          select: {
            id: true,
          },
        },
      },
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
    }),
    await prisma.user.count({
      where: whereClause,
    }),
  ]);

  return {
    users,
    totalPages: Math.ceil(count / perPage),
  };
};
