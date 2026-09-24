import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { mapEnvelopesToDocumentMany } from '@documenso/lib/utils/document';
import { prisma } from '@documenso/prisma';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import type { Envelope, Prisma } from '@prisma/client';
import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';
import { match, P } from 'ts-pattern';

import { authenticatedProcedure } from '../trpc';
import { type TInboxStatus, ZFindInboxRequestSchema, ZFindInboxResponseSchema } from './find-inbox.types';

export const findInboxRoute = authenticatedProcedure
  .input(ZFindInboxRequestSchema)
  .output(ZFindInboxResponseSchema)
  .query(async ({ input, ctx }) => {
    const { page, perPage, query, status } = input;

    const userId = ctx.user.id;

    const envelopes = await findInbox({
      userId,
      page,
      perPage,
      query,
      status,
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
  /**
   * Case insensitive search against the document title.
   */
  query?: string;

  /**
   * Restrict results to a single status. When omitted, every non-draft status is returned.
   */
  status?: TInboxStatus;
  orderBy?: {
    column: keyof Omit<Envelope, 'envelope'>;
    direction: 'asc' | 'desc';
  };
};

export const findInbox = async ({ userId, page = 1, perPage = 10, query = '', status, orderBy }: FindInboxOptions) => {
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
  const searchQuery = query.trim();

  const userRecipient = {
    email: user.email,
    role: {
      not: RecipientRole.CC,
    },
  } satisfies Prisma.RecipientWhereInput;

  const unsignedUserRecipient = {
    ...userRecipient,
    signingStatus: SigningStatus.NOT_SIGNED,
  } satisfies Prisma.RecipientWhereInput;

  const statusWhere = match(status)
    .with(undefined, () => ({
      status: { not: DocumentStatus.DRAFT },
      recipients: { some: userRecipient },
    }))
    .with(DocumentStatus.PENDING, () => ({
      status: DocumentStatus.PENDING,
      recipients: { some: unsignedUserRecipient },
    }))
    .with(ExtendedDocumentStatus.PARTIALLY_APPROVED, () => ({
      status: DocumentStatus.PENDING,
      recipients: { some: userRecipient, none: unsignedUserRecipient },
    }))
    .with(P.union(DocumentStatus.COMPLETED, DocumentStatus.REJECTED, DocumentStatus.CANCELLED), (value) => ({
      status: value,
      recipients: { some: userRecipient },
    }))
    .exhaustive() satisfies Prisma.EnvelopeWhereInput;

  const whereClause: Prisma.EnvelopeWhereInput = {
    type: EnvelopeType.DOCUMENT,
    deletedAt: null,
    ...statusWhere,
  };

  if (searchQuery.length > 0) {
    whereClause.title = {
      contains: searchQuery,
      mode: 'insensitive',
    };
  }

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

  // Not using the maskRecipientTokensForDocument helper here because it needs a
  // rework due to recipients vs Recipient.
  const maskedData = data.map((document) => ({
    ...document,
    recipients: document.recipients.map((recipient) => ({
      ...recipient,
      token: recipient.email === user.email ? recipient.token : '',
    })),
  }));

  return {
    data: maskedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
