import { compare, hash } from 'bcrypt';

import { prisma } from '@documenso/prisma';

import { SALT_ROUNDS } from '../../constants/auth';
import { isPasswordNull } from './is-password-null';

export type UpdatePasswordOptions = {
  userId: number;
  password: string;
  currentPassword?: string;
};

export const updatePassword = async ({
  userId,
  password,
  currentPassword,
}: UpdatePasswordOptions) => {
  console.log('userId', userId, 'update passowrd');
  // Existence check
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error('User has no password');
  }

  const isUserPasswordNull = await isPasswordNull({ id: userId });

  if (isUserPasswordNull) {
    const hashedNewPassword = await hash(password, SALT_ROUNDS);

    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedNewPassword,
      },
    });

    return updatedUser;
  } else {
    if (currentPassword && user.password) {
      const isCurrentPasswordValid = await compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect.');
      }

      // Compare the new password with the old password
      const isSamePassword = await compare(password, user.password);
      if (isSamePassword) {
        throw new Error('Your new password cannot be the same as your old password.');
      }

      const hashedNewPassword = await hash(password, SALT_ROUNDS);

      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          password: hashedNewPassword,
        },
      });

      return updatedUser;
    }
  }
};
