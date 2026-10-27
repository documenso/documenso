import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

import { adminProcedure } from '../../trpc';
import {
  ZFindEmailSuppressionsRequestSchema,
  ZFindEmailSuppressionsResponseSchema,
} from './find-email-suppressions.types';

export const findEmailSuppressionsRoute = adminProcedure
  .input(ZFindEmailSuppressionsRequestSchema)
  .output(ZFindEmailSuppressionsResponseSchema)
  .query(async ({ input }) => {
    const { query, page = 1, perPage = 20 } = input;

    const contains = { contains: query, mode: Prisma.QueryMode.insensitive };

    const where: Prisma.EmailSuppressionWhereInput = query
      ? {
          OR: [
            { email: contains },
            { organisation: { name: contains } },
            { team: { name: contains } },
            { user: { email: contains } },
          ],
        }
      : {};

    const [data, count] = await Promise.all([
      prisma.emailSuppression.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          email: true,
          scope: true,
          source: true,
          reason: true,
          createdAt: true,
          organisation: {
            select: {
              id: true,
              name: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.emailSuppression.count({ where }),
    ]);

    return {
      data,
      count,
      currentPage: page,
      perPage,
      totalPages: Math.ceil(count / perPage),
    };
  });
