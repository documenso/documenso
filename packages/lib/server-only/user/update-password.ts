import { hash } from 'bcrypt';

import { prisma } from '@documenso/prisma';

import { SALT_ROUNDS } from '../../constants/auth';

export type UpdatePasswordOptions = {
  userId: number;
  password: string;
};

export const updatePassword = async ({ userId, password }: UpdatePasswordOptions) => {
  // Existence check
  await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const hashedPassword = await hash(password, SALT_ROUNDS);

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      password: hashedPassword,
    },
  });

  return updatedUser;
};
