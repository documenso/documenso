import { prisma } from '@documenso/prisma';

export type SearchDocumentsWithKeywordOptions = {
  query: string;
  userId: number;
  limit: number;
};

export const searchDocumentsWithQuery = async ({
  query,
  limit,
  userId,
}: SearchDocumentsWithKeywordOptions) => {
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        {
          title: {
            contains: query,
            mode: 'insensitive',
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
        },
      ],
      userId: userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    include: {
      Recipient: true,
    },
  });

  return documents;
};
