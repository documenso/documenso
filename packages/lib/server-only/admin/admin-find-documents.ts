import { prisma } from '@documenso/prisma';
import { EnvelopeType, type Prisma } from '@prisma/client';

import type { FindResultResponse } from '../../types/search-params';

export interface AdminFindDocumentsOptions {
  query?: string;
  page?: number;
  perPage?: number;
}

export const adminFindDocuments = async ({ query, page = 1, perPage = 10 }: AdminFindDocumentsOptions) => {
  let termFilters: Prisma.EnvelopeWhereInput | undefined = !query
    ? undefined
    : {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      };

  if (query?.startsWith('user:')) {
    const userId = parseInt(query.slice('user:'.length), 10);

    if (Number.isInteger(userId)) {
      termFilters = {
        userId: {
          equals: userId,
        },
      };
    }
  }

  if (query?.startsWith('team:')) {
    const teamId = parseInt(query.slice('team:'.length), 10);

    if (Number.isInteger(teamId)) {
      termFilters = {
        teamId: {
          equals: teamId,
        },
      };
    }
  }

  if (query && query?.startsWith('envelope_')) {
    termFilters = {
      id: {
        equals: query,
      },
    };
  }

  if (query && query?.startsWith('document_')) {
    termFilters = {
      secondaryId: {
        equals: query,
      },
    };
  }

  if (query) {
    const isQueryAnInteger = !isNaN(parseInt(query));

    if (isQueryAnInteger) {
      termFilters = {
        secondaryId: {
          equals: `document_${query}`,
        },
      };
    }
  }

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
        envelopeItems: {
          select: {
            id: true,
            envelopeId: true,
            title: true,
            order: true,
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
