import { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

type GetAllUsersProps = {
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
}: GetAllUsersProps) => {
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
    prisma.user.findMany({
      include: {
        documents: {
          select: {
            id: true,
          },
        },
      },
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  return {
    users,
    totalPages: Math.ceil(count / perPage),
  };
};
