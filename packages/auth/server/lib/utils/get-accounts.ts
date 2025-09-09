import type { Context } from 'hono';

import { prisma } from '@documenso/prisma';

import { getSession } from './get-session';

export type PartialAccount = {
  id: string;
  userId: number;
  type: string;
  provider: string;
  providerAccountId: string;
  createdAt: Date;
};

export const getAccounts = async (c: Context | Request): Promise<PartialAccount[]> => {
  const { user } = await getSession(c);

  return await prisma.account.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      userId: true,
      type: true,
      provider: true,
      providerAccountId: true,
      createdAt: true,
    },
  });
};
