import { prisma } from '@documenso/prisma';

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
          deletedAt: {
            equals: null,
          },
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
          deletedAt: {
            equals: null,
          },
        },
        {
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

  return documents;
};
