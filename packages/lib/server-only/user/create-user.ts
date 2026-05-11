import { prisma } from '@documenso/prisma';
import { hash } from '@node-rs/bcrypt';
import type { User } from '@prisma/client';

import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { createPersonalOrganisation } from '../organisation/create-organisation';

export interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  signature?: string | null;
}

export const createUser = async ({ name, email, password, signature }: CreateUserOptions) => {
  const hashedPassword = await hash(password, SALT_ROUNDS);

  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS);
  }

  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword, // Todo: (RR7) Drop password.
        signature,
      },
    });

    // Todo: (RR7) Migrate to use this after RR7.
    // await tx.account.create({
    //   data: {
    //     userId: user.id,
    //     type: 'emailPassword', // Todo: (RR7)
    //     provider: 'DOCUMENSO', // Todo: (RR7) Enums
    //     providerAccountId: user.id.toString(),
    //     password: hashedPassword,
    //   },
    // });

    return user;
  });

  // Not used at the moment, uncomment if required.
  await onCreateUserHook(user).catch((err) => {
    // Todo: (RR7) Add logging.
    console.error(err);
  });

  return user;
};

export type OnCreateUserHookOptions = {
  /**
   * When true, do not create a "Personal Organisation" for the new user.
   * Used by the Organisation SSO signup path, where the user is intended
   * to operate inside the SSO organisation rather than a personal space.
   *
   * Defaults to false — preserves the historical behaviour of creating a
   * personal organisation for every new user.
   */
  skipPersonalOrganisation?: boolean;
};

/**
 * Should be run after a user is created, example during email password signup or google sign in.
 *
 * @returns User
 */
export const onCreateUserHook = async (user: User, options: OnCreateUserHookOptions = {}) => {
  if (!options.skipPersonalOrganisation) {
    await createPersonalOrganisation({ userId: user.id });
  }

  return user;
};
