import { compare, hash } from 'bcrypt';

import { prisma } from '@documenso/prisma';

import { SALT_ROUNDS } from '../../constants/auth';

export type UpdatePasswordOptions = {
  userId: number;
  password: string;
};

export const updatePassword = async ({ userId, password }: UpdatePasswordOptions) => {
  // Existence check
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const hashedPassword = await hash(password, SALT_ROUNDS);

  // Compare the new password with the old password
  const isSamePassword = await compare(password, user.password as string);

  if (isSamePassword) {
    throw new Error('Your new password cannot be the same as your old password.');
  }

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
