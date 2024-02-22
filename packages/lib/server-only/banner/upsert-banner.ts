'use server';

import { prisma } from '@documenso/prisma';
import { Role } from '@documenso/prisma/client';

export type UpdateUserOptions = {
  userId: number;
  show?: boolean;
  text?: string | undefined;
};

export const upsertBanner = async ({ userId, show, text }: UpdateUserOptions) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user?.roles.includes(Role.ADMIN)) {
    throw Error('You are unauthorised to perform this action');
  }

  return await prisma.banner.upsert({
    where: { id: 1, user: {} },
    update: { show, text },
    create: { show, text: text ?? '' },
  });
};
