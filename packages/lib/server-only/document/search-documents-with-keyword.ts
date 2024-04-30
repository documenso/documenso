import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';
import type { Document, Recipient, User } from '@documenso/prisma/client';

export type SearchDocumentsWithKeywordOptions = {
  query: string;
  userId: number;
  limit?: number;
};

export const searchDocumentsWithKeyword = async ({
  query,
  userId,
  limit = 5,
}: SearchDocumentsWithKeywordOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        {
          title: {
            contains: query,
            mode: 'insensitive',
          },
          userId: userId,
          deletedAt: null,
        },
        {
          Recipient: {
            some: {
              email: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
          userId: userId,
          deletedAt: null,
        },
        {
          status: DocumentStatus.COMPLETED,
          Recipient: {
            some: {
              email: user.email,
            },
          },
          title: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          status: DocumentStatus.PENDING,
          Recipient: {
            some: {
              email: user.email,
            },
          },
          title: {
            contains: query,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
      ],
    },
    include: {
      Recipient: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  const isOwner = (document: Document, user: User) => document.userId === user.id;
  const getSigningLink = (recipients: Recipient[], user: User) =>
    `/sign/${recipients.find((r) => r.email === user.email)?.token}`;

  const maskedDocuments = documents.map((document) => {
    const { Recipient, ...documentWithoutRecipient } = document;

    return {
      ...documentWithoutRecipient,
      path: isOwner(document, user) ? `/documents/${document.id}` : getSigningLink(Recipient, user),
      value: [document.id, document.title, ...document.Recipient.map((r) => r.email)].join(' '),
    };
  });

  return maskedDocuments;
};
