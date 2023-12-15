import { hash } from 'bcrypt';

import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { prisma } from '@documenso/prisma';
import { IdentityProvider } from '@documenso/prisma/client';

import { SALT_ROUNDS } from '../../constants/auth';
import { getFlag } from '../../universal/get-feature-flag';

export interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  signature?: string | null;
}

export const createUser = async ({ name, email, password, signature }: CreateUserOptions) => {
  const isBillingEnabled = await getFlag('app_billing');

  const hashedPassword = await hash(password, SALT_ROUNDS);

  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new Error('User already exists');
  }

  let user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      signature,
      identityProvider: IdentityProvider.DOCUMENSO,
    },
  });

  if (isBillingEnabled) {
    try {
      const stripeSession = await getStripeCustomerByUser(user);
      user = stripeSession.user;
    } catch (e) {
      console.error(e);
    }
  }

  return user;
};
