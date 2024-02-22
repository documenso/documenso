'use server';

import { prisma } from '@documenso/prisma';

export const getBanner = async () => {
  return await prisma.banner.findUnique({
    where: {
      id: 1,
    },
  });
};
