import { EnvelopeType, type Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import type { FindResultResponse } from '../../types/search-params';

export interface AdminFindDocumentsOptions {
  query?: string;
  page?: number;
  perPage?: number;
}

export const adminFindDocuments = async ({
  query,
  page = 1,
  perPage = 10,
}: AdminFindDocumentsOptions) => {
  const termFilters: Prisma.EnvelopeWhereInput | undefined = !query
    ? undefined
    : {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      };

  const [data, count] = await Promise.all([
    prisma.envelope.findMany({
      where: {
        type: EnvelopeType.DOCUMENT,
        ...termFilters,
      },
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipients: true,
        team: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    }),
    prisma.envelope.count({
      where: {
        type: EnvelopeType.DOCUMENT,
        ...termFilters,
      },
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
