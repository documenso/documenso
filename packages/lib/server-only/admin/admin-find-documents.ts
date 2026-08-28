import { prisma } from '@documenso/prisma';
import { EnvelopeType, type Prisma } from '@prisma/client';
import { z } from 'zod';

import type { FindResultResponse } from '../../types/search-params';

export interface AdminFindDocumentsOptions {
  query?: string;
  page?: number;
  perPage?: number;
}

const MAX_POSTGRES_INT = 2147483647;

/**
 * IDs are Postgres int4 columns: values above the range can never be valid
 * IDs and would make Prisma throw on overflow, so the schema rejects them.
 */
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

    if (recipientQuery.length === 0) {
      return emptyResponse;
    }

    // Bare numeric values are exact recipient ID lookups, consistent with the
    // user: and team: prefixes. Oversized numbers cannot be IDs and fall back
    // to the text search, mirroring the admin global search.
    const parsedRecipientId = ZPositiveIntegerSchema.safeParse(recipientQuery);

    if (/^\d+$/.test(recipientQuery) && parsedRecipientId.success) {
      termFilters = {
        recipients: {
          some: {
            id: parsedRecipientId.data,
          },
        },
      };
    } else {
      termFilters = {
        recipients: {
          some: {
            OR: [
              { email: { contains: recipientQuery, mode: 'insensitive' } },
              { name: { contains: recipientQuery, mode: 'insensitive' } },
            ],
          },
        },
      };
    }
  }

  if (query?.startsWith('envelope_')) {
    termFilters = {
      id: {
        equals: query,
      },
    };
  }

  if (query?.startsWith('document_')) {
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
