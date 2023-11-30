import { prisma } from '@documenso/prisma';

type GetDocumentsProps = {
  page: number;
  perPage: number;
  userId: number;
};

export const getDocuments = async ({ page = 1, perPage = 10, userId }: GetDocumentsProps) => {
  const [documents, count] = await Promise.all([
    await prisma.document.findMany({
      where: {
        userId,
      },
      take: perPage,
      skip: Math.max(page - 1, 0) * perPage,
    }),
    await prisma.document.count(),
  ]);

  return {
    documents,
    totalPages: Math.ceil(count / perPage),
  };
};
