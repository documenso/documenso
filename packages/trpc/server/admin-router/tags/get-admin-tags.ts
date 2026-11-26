import { prisma } from '@documenso/prisma';
import type { Prisma } from '@prisma/client';
import { adminProcedure } from '../../trpc';
import { ZGetAdminTagsRequestSchema, ZGetAdminTagsResponseSchema } from './get-admin-tags.types';

export const getAdminTagsRoute = adminProcedure
  .input(ZGetAdminTagsRequestSchema)
  .output(ZGetAdminTagsResponseSchema)
  .query(async ({ input }) => {
    const whereClause: Prisma.AdminTagWhereInput =
      input.type === 'user'
        ? {
            userId: input.userId,
          }
        : {
            organisationId: input.organisationId,
          };

    return await prisma.adminTag.findMany({
      where: whereClause,
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
