import { prisma } from '@documenso/prisma';
import { Document, DocumentStatus, Prisma } from '@documenso/prisma/client';

import { DocumentWithReciepient } from '../../types/document-with-recipient';
import { FindResultSet } from '../../types/find-result-set';

export interface FindDocumentsOptions {
  userId: number;
  term?: string;
  status?: DocumentStatus;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Omit<Document, 'document'>;
    direction: 'asc' | 'desc';
  };
}

export const findDocuments = async ({
  userId,
  term,
  status,
  page = 1,
  perPage = 10,
  orderBy,
}: FindDocumentsOptions): Promise<FindResultSet<DocumentWithReciepient>> => {
  const orderByColumn = orderBy?.column ?? 'created';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const filters: Prisma.DocumentWhereInput = {
    status,
    userId,
  };

  if (term) {
    filters.title = {
      contains: term,
      mode: 'insensitive',
    };
  }

  const [data, count] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...filters,
      },
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      include: {
        Recipient: true,
      },
    }),
    prisma.document.count({
      where: {
        ...filters,
      },
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  };
};
