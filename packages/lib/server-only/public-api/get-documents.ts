import { prisma } from '@documenso/prisma';

type GetDocumentsProps = {
  page: number;
  perPage: number;
};

export const getDocuments = async ({ page = 1, perPage = 10 }: GetDocumentsProps) => {
  const [documents, count] = await Promise.all([
    await prisma.document.findMany({
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
