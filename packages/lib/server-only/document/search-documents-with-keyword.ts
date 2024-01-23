import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

import { maskRecipientTokensForDocument } from '../../utils/mask-recipient-tokens-for-document';

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

  const maskedDocuments = documents.map((document) =>
    maskRecipientTokensForDocument({
      document,
      user,
    }),
  );

  return maskedDocuments;
};
