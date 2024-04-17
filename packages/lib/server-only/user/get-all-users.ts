import { prisma } from '@documenso/prisma';
import { Prisma } from '@documenso/prisma/client';

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
<<<<<<< HEAD
    await prisma.user.findMany({
=======
    prisma.user.findMany({
>>>>>>> main
      include: {
        Subscription: true,
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
<<<<<<< HEAD
    await prisma.user.count({
=======
    prisma.user.count({
>>>>>>> main
      where: whereClause,
    }),
  ]);

  return {
    users,
    totalPages: Math.ceil(count / perPage),
  };
};
