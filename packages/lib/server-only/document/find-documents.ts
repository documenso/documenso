import { DateTime } from 'luxon';
import { P, match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import type { Document, Prisma } from '@documenso/prisma/client';
import { SigningStatus } from '@documenso/prisma/client';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import type { FindResultSet } from '../../types/find-result-set';
import { maskRecipientTokensForDocument } from '../../utils/mask-recipient-tokens-for-document';

export type FindDocumentsOptions = {
  userId: number;
  term?: string;
  status?: ExtendedDocumentStatus;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Omit<Document, 'document'>;
    direction: 'asc' | 'desc';
  };
  period?: '' | '7d' | '14d' | '30d';
};

export const findDocuments = async ({
  userId,
  term,
  status = ExtendedDocumentStatus.ALL,
  page = 1,
  perPage = 10,
  orderBy,
  period,
}: FindDocumentsOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const termFilters = match(term)
    .with(P.string.minLength(1), () => {
      return {
        title: {
          contains: term,
          mode: 'insensitive',
        },
      } as const;
    })
    .otherwise(() => undefined);

  const filters = match<ExtendedDocumentStatus, Prisma.DocumentWhereInput>(status)
    .with(ExtendedDocumentStatus.ALL, () => ({
      OR: [
        {
          userId,
          deletedAt: null,
        },
        {
          status: ExtendedDocumentStatus.COMPLETED,
          Recipient: {
            some: {
              email: user.email,
            },
          },
        },
        {
          status: ExtendedDocumentStatus.PENDING,
          Recipient: {
            some: {
              email: user.email,
            },
          },
          deletedAt: null,
        },
      ],
    }))
    .with(ExtendedDocumentStatus.INBOX, () => ({
      status: {
        not: ExtendedDocumentStatus.DRAFT,
      },
      Recipient: {
        some: {
          email: user.email,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      },
      deletedAt: null,
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      userId,
      status: ExtendedDocumentStatus.DRAFT,
      deletedAt: null,
    }))
    .with(ExtendedDocumentStatus.PENDING, () => ({
      OR: [
        {
          userId,
          status: ExtendedDocumentStatus.PENDING,
          deletedAt: null,
        },
        {
          status: ExtendedDocumentStatus.PENDING,
          Recipient: {
            some: {
              email: user.email,
              signingStatus: SigningStatus.SIGNED,
            },
          },
          deletedAt: null,
        },
      ],
    }))
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      OR: [
        {
          userId,
          status: ExtendedDocumentStatus.COMPLETED,
          deletedAt: null,
        },
        {
          status: ExtendedDocumentStatus.COMPLETED,
          Recipient: {
            some: {
              email: user.email,
            },
          },
        },
      ],
    }))
    .exhaustive();

  const whereClause = {
    ...termFilters,
    ...filters,
  };

  if (period) {
    const daysAgo = parseInt(period.replace(/d$/, ''), 10);

    const startOfPeriod = DateTime.now().minus({ days: daysAgo }).startOf('day');

    whereClause.createdAt = {
      gte: startOfPeriod.toJSDate(),
    };
  }

  const [data, count] = await Promise.all([
    prisma.document.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
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
        ...filters,
      },
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
  } satisfies FindResultSet<typeof data>;
};
