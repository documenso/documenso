import { prisma } from '@documenso/prisma';

export type GetTemplatesOptions = {
  userId: number;
  page: number;
  perPage: number;
};

export const getTemplates = async ({ userId, page = 1, perPage = 10 }: GetTemplatesOptions) => {
  const [templates, count] = await Promise.all([
    await prisma.template.findMany({
      where: {
        userId: userId,
      },
      skip: Math.max(page - 1, 0) * perPage,
    }),
    await prisma.template.count({
      where: {
        User: {
          id: userId,
        },
      },
    }),
  ]);

  return {
    templates,
    totalPages: Math.ceil(count / perPage),
  };
};
