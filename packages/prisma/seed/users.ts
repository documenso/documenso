import { hashSync } from '@documenso/lib/server-only/auth/hash';

import { prisma } from '..';

type SeedUserOptions = {
  name?: string;
  email?: string;
  password?: string;
  verified?: boolean;
};

export const seedUser = async ({
  name = `user-${Date.now()}`,
  email = `user-${Date.now()}@test.documenso.com`,
  password = 'password',
  verified = true,
}: SeedUserOptions = {}) => {
  return await prisma.user.create({
    data: {
      name,
      email,
      password: hashSync(password),
      emailVerified: verified ? new Date() : undefined,
      url: name,
    },
  });
};

export const unseedUser = async (userId: number) => {
  await prisma.user.delete({
    where: {
      id: userId,
    },
  });
};

export const unseedUserByEmail = async (email: string) => {
  await prisma.user.delete({
    where: {
      email,
    },
  });
};

export const extractUserVerificationToken = async (email: string) => {
  return await prisma.verificationToken.findFirstOrThrow({
    where: {
      identifier: 'confirmation-email',
      user: {
        email,
      },
    },
  });
};
