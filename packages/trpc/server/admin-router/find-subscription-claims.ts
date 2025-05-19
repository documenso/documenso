import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';
import type SubscriptionClaimSchema from '@documenso/prisma/generated/zod/modelSchema/SubscriptionClaimSchema';

import { adminProcedure } from '../trpc';
import {
  ZFindSubscriptionClaimsRequestSchema,
  ZFindSubscriptionClaimsResponseSchema,
} from './find-subscription-claims.types';

export const findSubscriptionClaimsRoute = adminProcedure
  .input(ZFindSubscriptionClaimsRequestSchema)
  .output(ZFindSubscriptionClaimsResponseSchema)
  .query(async ({ input }) => {
    const { query, page, perPage } = input;

    return await findSubscriptionClaims({ query, page, perPage });
  });

type FindSubscriptionClaimsOptions = {
  query?: string;
  page?: number;
  perPage?: number;
};

export const findSubscriptionClaims = async ({
  query,
  page = 1,
  perPage = 50,
}: FindSubscriptionClaimsOptions) => {
  let whereClause: Prisma.SubscriptionClaimWhereInput = {};

  if (query) {
    whereClause = {
      OR: [
        {
          id: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ],
    };
  }

  const [data, count] = await Promise.all([
    prisma.subscriptionClaim.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.subscriptionClaim.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<z.infer<typeof SubscriptionClaimSchema>[]>;
};
