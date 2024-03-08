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

export const seed2faUser = async ({
  name = `2fa-user-${Date.now()}`,
  email = `2fa-user-${Date.now()}@test.documenso.com`,
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
      twoFactorEnabled: true,
      twoFactorSecret:
        'b2840b216b1f089cb086bdd4260196c645d90b0bd3ff8f66d20d19b99a0da1631bf299e416476917194f1064f58b',
      twoFactorBackupCodes: 'a-bunch-of-backup-codes',
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
