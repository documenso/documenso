import { prisma } from '@documenso/prisma';

export type DeleteUserOptions = {
  email: string;
};

export const deleteUser = async ({ email }: DeleteUserOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        contains: email,
      },
    },
  });

  const defaultDeleteUser = await prisma.user.findFirst({
    where: {
      email: 'deleted@documenso.com',
    },
  });

  if (!user) {
    throw new Error(`User with email ${email} not found`);
  }

  if (!defaultDeleteUser) {
    throw new Error(`Default delete account not found`);
  }

  await prisma.document.updateMany({
    where: {
      userId: user.id,
      status: {
        in: ['PENDING', 'COMPLETED'],
      },
    },
    data: {
      userId: defaultDeleteUser.id,
    },
  });

  return await prisma.user.delete({
    where: {
      id: user.id,
    },
  });
};
