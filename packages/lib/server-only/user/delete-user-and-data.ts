import { prisma } from '@documenso/prisma';

export const deleteUserAndItsData = async (name: string) => {
  const user = await prisma.user.findFirst({
    where: {
      name: {
        contains: name,
      },
    },
  });

  if (!user) {
    throw new Error(`User with name ${name} not found`);
  }

  const document = await prisma.document.findMany({
    where: {
      userId: user.id,
    },
    select: {
      documentData: {
        select: {
          data: true,
        },
      },
    },
  });

  return prisma.$transaction([
    prisma.user.delete({
      where: {
        id: user.id,
      },
    }),
    prisma.documentData.deleteMany({
      where: {
        data: document[0]?.documentData.data,
      },
    }),
  ]);
};
