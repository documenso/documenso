import { prisma } from '@documenso/prisma';

export const findComments = async () => {
  return await prisma.documentComment.findMany({
    where: {
      parentId: null,
    },
    include: {
      User: {
        select: {
          name: true,
        },
      },
      replies: {
        include: {
          User: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
};
