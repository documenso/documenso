import { hash } from 'bcrypt';

import { prisma } from '@documenso/prisma';
import { IdentityProvider } from '@documenso/prisma/client';

import { SALT_ROUNDS } from '../../constants/auth';

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
    throw new Error('User already exists');
  }

  return await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      signature,
      identityProvider: IdentityProvider.DOCUMENSO,
    },
  });
};
