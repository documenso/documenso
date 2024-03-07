import { hashSync } from '@documenso/lib/server-only/auth/hash';

import { prisma } from '..';

//
// https://github.com/documenso/documenso/pull/713
//

const PULL_REQUEST_NUMBER = 718;

const EMAIL_DOMAIN = `pr-${PULL_REQUEST_NUMBER}.documenso.com`;

export const TEST_USER = {
  name: 'User 1',
  email: `user1@${EMAIL_DOMAIN}`,
  password: 'Password123',
} as const;

export const seedDatabase = async () => {
  await prisma.user.create({
    data: {
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: hashSync(TEST_USER.password),
      emailVerified: new Date(),
      url: TEST_USER.email,
    },
  });
};
