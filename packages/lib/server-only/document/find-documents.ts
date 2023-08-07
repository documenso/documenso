import { prisma } from '@documenso/prisma';
import { Document, DocumentStatus, Prisma, SigningStatus } from '@documenso/prisma/client';
import { DocumentWithRecipientAndSender } from '@documenso/prisma/types/document';
import { DocumentWithReciepient } from '@documenso/prisma/types/document-with-recipient';

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

export interface FindDocumentsWithRecipientAndSenderOptions {
  email: string;
  query?: string;
  signingStatus?: SigningStatus;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Omit<Document, 'document'>;
    direction: 'asc' | 'desc';
  };
}

export const findDocumentsWithRecipientAndSender = async ({
  email,
  query,
  signingStatus,
  page = 1,
  perPage = 20,
  orderBy,
}: FindDocumentsWithRecipientAndSenderOptions): Promise<
  FindResultSet<DocumentWithRecipientAndSender>
> => {
  const orderByColumn = orderBy?.column ?? 'created';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const filters: Prisma.DocumentWhereInput = {
    Recipient: {
      some: {
        email,
        signingStatus,
      },
    },
  };

  if (query) {
    filters.OR = [
      {
        User: {
          email: {
            contains: query,
            mode: 'insensitive',
          },
        },
        // Todo: Add filter for `Subject`.
      },
    ];
  }

  const [data, count] = await Promise.all([
    prisma.document.findMany({
      select: {
        id: true,
        created: true,
        title: true,
        status: true,
        userId: true,
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Recipient: {
          where: {
            email,
            signingStatus,
          },
        },
      },
      where: {
        ...filters,
      },
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
    }),
    prisma.document.count({
      where: {
        ...filters,
      },
    }),
  ]);

  return {
    data: data.map((item) => {
      const { User, Recipient, ...rest } = item;

      const subject = undefined; // Todo.
      const description = undefined; // Todo.

      return {
        ...rest,
        sender: User,
        recipient: Recipient[0],
        subject: subject ?? 'Please sign this document',
        description: description ?? `${User.name} has invited you to sign "${item.title}"`,
      };
    }),
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  };
};
