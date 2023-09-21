import { prisma } from '@documenso/prisma';

type getAllUsersProps = {
  page: number;
  perPage: number;
};

export const findUsers = async ({ page = 1, perPage = 10 }: getAllUsersProps) => {
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
      },
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
    }),
    await prisma.user.count(),
  ]);

  return {
    users,
    totalPages: Math.ceil(count / perPage),
  };
};
