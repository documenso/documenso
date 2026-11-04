import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import { ZGetAdminTagsRequestSchema, ZGetAdminTagsResponseSchema } from './get-admin-tags.types';

export const getAdminTagsRoute = adminProcedure
  .input(ZGetAdminTagsRequestSchema)
  .output(ZGetAdminTagsResponseSchema)
  .query(async ({ input }) => {
    const { userId } = input;

    return await prisma.adminTag.findMany({
      where: {
        userId,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        adminRule: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });
