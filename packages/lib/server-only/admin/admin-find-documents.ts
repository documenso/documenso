import { prisma } from '@documenso/prisma';
import { EnvelopeType, type Prisma } from '@prisma/client';
import { z } from 'zod';

import { MAX_POSTGRES_INT } from '../../constants/database';
import type { FindResultResponse } from '../../types/search-params';

export interface AdminFindDocumentsOptions {
  query?: string;
  page?: number;
  perPage?: number;
}

const ZPositiveIntegerSchema = z.coerce.number().int().positive().max(MAX_POSTGRES_INT);

const emptyResponse = {
  data: [],
  count: 0,
  currentPage: 1,
  perPage: 10,
  totalPages: 0,
};

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
    const parsedUserId = ZPositiveIntegerSchema.safeParse(query.slice('user:'.length));

    if (parsedUserId.success) {
      termFilters = {
        userId: {
          equals: parsedUserId.data,
        },
      };
    } else {
      return emptyResponse;
    }
  }

  if (query?.startsWith('team:')) {
    const parsedTeamId = ZPositiveIntegerSchema.safeParse(query.slice('team:'.length));

    if (parsedTeamId.success) {
      termFilters = {
        teamId: {
          equals: parsedTeamId.data,
        },
      };
    } else {
      return emptyResponse;
    }
  }

  if (query?.startsWith('recipient:')) {
    const recipientQuery = query.slice('recipient:'.length).trim();

    if (!recipientQuery) {
      return emptyResponse;
    }

    // Match admin-global-search semantics: only bare digit strings are ID
    // lookups, so numeric-looking email fragments (1e3, 0x10, +40) stay text.
    const isRecipientIdLookup = /^\d+$/.test(recipientQuery);

    const parsedRecipientId = ZPositiveIntegerSchema.safeParse(recipientQuery);

    termFilters =
      isRecipientIdLookup && parsedRecipientId.success
        ? {
            recipients: {
              some: {
                id: parsedRecipientId.data,
              },
            },
          }
        : {
            recipients: {
              some: {
                email: {
                  contains: recipientQuery,
                  mode: 'insensitive',
                },
              },
            },
          };
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
