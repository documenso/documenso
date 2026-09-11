import { prisma } from '@documenso/prisma';

import type { TUserAuthMethod } from '../../types/user-auth-method';
import { deriveUserAuthMethods } from '../../utils/user-auth-methods';

export type GetUserAuthMethodsOptions = {
  userId: number;
};

/**
 * Get the distinct sign in methods available to a user, such as password,
 * passkey or linked OAuth providers.
 */
export const getUserAuthMethods = async ({ userId }: GetUserAuthMethodsOptions): Promise<TUserAuthMethod[]> => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      password: true,
      accounts: {
        select: {
          provider: true,
        },
      },
      _count: {
        select: {
          passkeys: true,
        },
      },
    },
  });

  return deriveUserAuthMethods({
    hasPassword: user.password !== null,
    passkeyCount: user._count.passkeys,
    accountProviders: user.accounts.map((account) => account.provider),
  });
};
