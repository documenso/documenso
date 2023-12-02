import { prisma } from '@documenso/prisma';

export type SearchDocumentsWithKeywordOptions = {
  query: string;
  userId: number;
};

export const SearchDocumentsWithKeyword = async ({
  query,
  userId,
}: SearchDocumentsWithKeywordOptions) => {
  // modify this to make it casse insensitive
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
              },
            },
          },
        },
      ],
      userId: userId,
    },
    include: {
      Recipient: true,
    },
  });

  return documents;
};
