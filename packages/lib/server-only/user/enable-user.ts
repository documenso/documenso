import { prisma } from '@documenso/prisma';

export type EnableUserOptions = {
  id: number;
};

export const enableUser = async ({ id }: EnableUserOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
    },
  });

  if (!user) {
    throw new Error('There was an error enabling the user');
  }

  await prisma.user.update({
    where: {
      id,
    },
    data: {
      disabled: false,
    },
  });
};
