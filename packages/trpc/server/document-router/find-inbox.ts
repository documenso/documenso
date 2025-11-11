import type { Envelope, Prisma } from '@prisma/client';
import { DocumentStatus, EnvelopeType, RecipientRole } from '@prisma/client';

import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { mapEnvelopesToDocumentMany } from '@documenso/lib/utils/document';
import { maskRecipientTokensForDocument } from '@documenso/lib/utils/mask-recipient-tokens-for-document';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZFindInboxRequestSchema, ZFindInboxResponseSchema } from './find-inbox.types';

export const findInboxRoute = authenticatedProcedure
  .input(ZFindInboxRequestSchema)
  .output(ZFindInboxResponseSchema)
  .query(async ({ input, ctx }) => {
    const { page, perPage } = input;

    const userId = ctx.user.id;

    const envelopes = await findInbox({
      userId,
      page,
      perPage,
    });

    return {
      ...envelopes,
      data: envelopes.data.map(mapEnvelopesToDocumentMany),
    };
  });

export type FindInboxOptions = {
  userId: number;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Omit<Envelope, 'envelope'>;
    direction: 'asc' | 'desc';
  };
};

export const findInbox = async ({ userId, page = 1, perPage = 10, orderBy }: FindInboxOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
    },
  });

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause: Prisma.EnvelopeWhereInput = {
    type: EnvelopeType.DOCUMENT,
    status: {
      not: DocumentStatus.DRAFT,
    },
    deletedAt: null,
    recipients: {
      some: {
        email: user.email,
        role: {
          not: RecipientRole.CC,
        },
      },
    },
  };

  const [data, count] = await Promise.all([
    prisma.envelope.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
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
      where: whereClause,
    }),
  ]);

  const maskedData = data.map((document) =>
    maskRecipientTokensForDocument({
      document,
      user,
    }),
  );

  return {
    data: maskedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
