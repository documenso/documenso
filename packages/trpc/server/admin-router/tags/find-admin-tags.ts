import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

import { adminProcedure } from '../../trpc';
import { ZFindAdminTagsRequestSchema, ZFindAdminTagsResponseSchema } from './find-admin-tags.types';

export const findAdminTagsRoute = adminProcedure
  .input(ZFindAdminTagsRequestSchema)
  .output(ZFindAdminTagsResponseSchema)
  .query(async ({ input }) => {
    const { query, type, subjectType, source, orderByColumn, orderByDirection, page = 1, perPage = 20 } = input;

    const whereClause: Prisma.AdminTagWhereInput = {
      type,
    };

    if (subjectType === 'user') {
      whereClause.userId = {
        not: null,
      };
    }

    if (subjectType === 'organisation') {
      whereClause.organisationId = {
        not: null,
      };
    }

    if (source === 'admin') {
      whereClause.createdByUserId = {
        not: null,
      };
    }

    if (source === 'rule') {
      whereClause.adminRuleId = {
        not: null,
      };
    }

    if (query) {
      whereClause.OR = [
        {
          description: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          user: {
            email: {
              contains: query,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          user: {
            name: {
              contains: query,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          organisation: {
            name: {
              contains: query,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          organisation: {
            url: {
              contains: query,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
      ];
    }

    const [tags, count] = await Promise.all([
      prisma.adminTag.findMany({
        where: whereClause,
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        // Tags created together share a timestamp, so the id keeps pages from overlapping.
        orderBy: [
          {
            [orderByColumn]: orderByDirection,
          },
          {
            id: orderByDirection,
          },
        ],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          organisation: {
            select: {
              id: true,
              name: true,
              url: true,
            },
          },
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
      }),
      prisma.adminTag.count({
        where: whereClause,
      }),
    ]);

    return {
      data: tags,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof tags>;
  });
