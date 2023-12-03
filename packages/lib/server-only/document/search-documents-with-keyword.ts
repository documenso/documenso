import { prisma } from '@documenso/prisma';

export type SearchDocumentsWithKeywordOptions = {
  query: string;
  userId: number;
};

export const searchDocumentsWithKeyword = async ({
  query,
  userId,
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
        },
        {
          Recipient: {
            some: {
              email: {
                contains: query,
              },
            },
          },
          userId: userId,
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
  });

  return documents;
};
