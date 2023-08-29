import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import { Document, Prisma, SigningStatus } from '@documenso/prisma/client';
import { DocumentWithRecipientAndSender } from '@documenso/prisma/types/document';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import { FindResultSet } from '../../types/find-result-set';

export interface FindDocumentsOptions {
  userId: number;
  term?: string;
  status?: ExtendedDocumentStatus;
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
  status = ExtendedDocumentStatus.ALL,
  page = 1,
  perPage = 10,
  orderBy,
}: FindDocumentsOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const orderByColumn = orderBy?.column ?? 'created';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const termFilters = !term
    ? undefined
    : ({
        title: {
          contains: term,
          mode: 'insensitive',
        },
      } as const);

  const filters = match<ExtendedDocumentStatus, Prisma.DocumentWhereInput>(status)
    .with(ExtendedDocumentStatus.ALL, () => ({
      OR: [
        {
          userId,
        },
        {
          status: {
            not: ExtendedDocumentStatus.DRAFT,
          },
          Recipient: {
            some: {
              email: user.email,
            },
          },
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
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      userId,
      status: ExtendedDocumentStatus.DRAFT,
    }))
    .with(ExtendedDocumentStatus.PENDING, () => ({
      OR: [
        {
          userId,
          status: ExtendedDocumentStatus.PENDING,
        },
        {
          status: ExtendedDocumentStatus.PENDING,

          Recipient: {
            some: {
              email: user.email,
              signingStatus: SigningStatus.SIGNED,
            },
          },
        },
      ],
    }))
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      OR: [
        {
          userId,
          status: ExtendedDocumentStatus.COMPLETED,
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

  const [data, count] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...termFilters,
        ...filters,
      },
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

  const maskedData = data.map((doc) => ({
    ...doc,
    Recipient: doc.Recipient.map((recipient) => ({
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
  } satisfies FindResultSet<typeof maskedData>;
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
