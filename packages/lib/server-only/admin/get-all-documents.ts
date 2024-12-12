import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';

import type { FindResultResponse } from '../../types/search-params';

export interface FindDocumentsOptions {
  query?: string;
  page?: number;
  perPage?: number;
}

export const findDocuments = async ({ query, page = 1, perPage = 10 }: FindDocumentsOptions) => {
  const termFilters: Prisma.DocumentWhereInput | undefined = !query
    ? undefined
    : {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      };

  const [data, count] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...termFilters,
      },
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Recipient: true,
      },
    }),
    prisma.document.count({
      where: {
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
