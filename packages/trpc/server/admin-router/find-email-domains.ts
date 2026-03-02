import { Prisma } from '@documenso/prisma/client';

import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZFindEmailDomainsRequestSchema,
  ZFindEmailDomainsResponseSchema,
} from './find-email-domains.types';

export const findEmailDomainsRoute = adminProcedure
  .input(ZFindEmailDomainsRequestSchema)
  .output(ZFindEmailDomainsResponseSchema)
  .query(async ({ input }) => {
    const { query, page, perPage, status } = input;

    return await findEmailDomains({ query, page, perPage, status });
  });

type FindEmailDomainsOptions = {
  query?: string;
  page?: number;
  perPage?: number;
  status?: 'PENDING' | 'ACTIVE';
};

const findEmailDomains = async ({
  query,
  page = 1,
  perPage = 20,
  status,
}: FindEmailDomainsOptions) => {
  const whereClause: Prisma.EmailDomainWhereInput = {};

  if (query) {
    whereClause.OR = [
      {
        domain: {
          contains: query,
          mode: Prisma.QueryMode.insensitive,
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
    ];
  }

  if (status) {
    whereClause.status = status;
  }

  const [data, count] = await Promise.all([
    prisma.emailDomain.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        domain: true,
        status: true,
        selector: true,
        createdAt: true,
        updatedAt: true,
        lastVerifiedAt: true,
        organisation: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
        _count: {
          select: {
            emails: true,
          },
        },
      },
    }),
    prisma.emailDomain.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
