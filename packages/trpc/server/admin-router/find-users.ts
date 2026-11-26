import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, Prisma } from '@prisma/client';

import { adminProcedure } from '../trpc';
import { ZFindUsersRequestSchema, ZFindUsersResponseSchema } from './find-users.types';

export const findUsersRoute = adminProcedure
  .input(ZFindUsersRequestSchema)
  .output(ZFindUsersResponseSchema)
  .query(async ({ input }) => {
    const { query, role, page = 1, perPage = 10 } = input;

    const whereClause: Prisma.UserWhereInput = {};

    if (query) {
      whereClause.OR = [
        {
          name: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          email: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ];
    }

    if (role) {
      whereClause.roles = {
        has: role,
      };
    }

    const [users, count] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        orderBy: {
          id: 'desc',
        },
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
          _count: {
            select: {
              envelopes: {
                where: {
                  type: EnvelopeType.DOCUMENT,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({
        where: whereClause,
      }),
    ]);

    const data = users.map(({ _count, ...user }) => ({
      ...user,
      documentCount: _count.envelopes,
    }));

    return {
      data,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof data>;
  });
