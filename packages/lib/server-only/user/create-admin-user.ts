import { hash } from '@node-rs/bcrypt';
import crypto from 'crypto';

import { prisma } from '@documenso/prisma';

import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';

export interface CreateAdminUserOptions {
  name: string;
  email: string;
  signature?: string | null;
}

/**
 * Create a user for admin-initiated flows.
 *
 * Unlike normal signup, this function:
 * - Generates a secure random password (user must reset via email verification)
 * - Does NOT create a personal organisation (user will be added to real org)
 * - Returns the user immediately without side effects
 */
export const createAdminUser = async ({ name, email, signature }: CreateAdminUserOptions) => {
  // Generate a secure random password - user will reset via email verification
  const randomPassword = crypto.randomBytes(32).toString('hex');
  const hashedPassword = await hash(randomPassword, SALT_ROUNDS);

  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'User with this email already exists',
    });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      signature,
    },
  });

  return user;
};
