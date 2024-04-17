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

  if (!user) {
    throw new Error(`User with email ${email} not found`);
  }

  return await prisma.user.delete({
    where: {
      id: user.id,
    },
  });
};
