import { AppError } from '@doku-seal/lib/errors/app-error';
import { prisma } from '@doku-seal/prisma';

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
    throw new AppError('There was an error enabling the user');
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
