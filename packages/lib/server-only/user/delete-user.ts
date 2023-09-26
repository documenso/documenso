import { prisma } from '@documenso/prisma';

export const deleteUser = async (name: string) => {
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

  return await prisma.user.delete({
    where: {
      id: user.id,
    },
  });
};
