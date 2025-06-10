import { Prisma } from '@prisma/client';

import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZFindAdminOrganisationsRequestSchema,
  ZFindAdminOrganisationsResponseSchema,
} from './find-admin-organisations.types';

export const findAdminOrganisationsRoute = adminProcedure
  .input(ZFindAdminOrganisationsRequestSchema)
  .output(ZFindAdminOrganisationsResponseSchema)
  .query(async ({ input }) => {
    const { query, page, perPage, ownerUserId, memberUserId } = input;

    return await findAdminOrganisations({
      query,
      page,
      perPage,
      ownerUserId,
      memberUserId,
    });
  });

type FindAdminOrganisationsOptions = {
  query?: string;
  page?: number;
  perPage?: number;
  ownerUserId?: number;
  memberUserId?: number;
};

export const findAdminOrganisations = async ({
  query,
  page = 1,
  perPage = 10,
  ownerUserId,
  memberUserId,
}: FindAdminOrganisationsOptions) => {
  let whereClause: Prisma.OrganisationWhereInput = {};

  if (query) {
    whereClause = {
      OR: [
        {
          id: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          owner: {
            email: {
              contains: query,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          customerId: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          name: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    };
  }

  if (query && query.startsWith('claim:')) {
    whereClause = {
      organisationClaim: {
        originalSubscriptionClaimId: {
          contains: query.slice(6),
          mode: Prisma.QueryMode.insensitive,
        },
      },
    };
  }

  if (query && query.startsWith('org_')) {
    whereClause = {
      OR: [
        {
          id: {
            equals: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          url: {
            equals: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    };
  }

  if (ownerUserId) {
    whereClause = {
      ...whereClause,
      ownerUserId,
    };
  }

  if (memberUserId) {
    whereClause = {
      ...whereClause,
      members: {
        some: { userId: memberUserId },
      },
    };
  }

  const [data, count] = await Promise.all([
    prisma.organisation.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        url: true,
        customerId: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        subscription: true,
      },
    }),
    prisma.organisation.count({
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
