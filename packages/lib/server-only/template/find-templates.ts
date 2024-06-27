import { prisma } from '@documenso/prisma';
import type { Prisma, Template } from '@documenso/prisma/client';

export type FindTemplatesOptions = {
  userId: number;
  teamId?: number;
  type?: Template['type'];
  page?: number;
  perPage?: number;
};

export type FindTemplatesResponse = Awaited<ReturnType<typeof findTemplates>>;
export type FindTemplateRow = FindTemplatesResponse['templates'][number];

export const findTemplates = async ({
  userId,
  teamId,
  type,
  page = 1,
  perPage = 10,
}: FindTemplatesOptions) => {
  let whereFilter: Prisma.TemplateWhereInput = {
    userId,
    teamId: null,
    type,
  };

  if (teamId !== undefined) {
    whereFilter = {
      team: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    };
  }

  const [templates, count] = await Promise.all([
    prisma.template.findMany({
      where: whereFilter,
      include: {
        templateDocumentData: true,
        team: {
          select: {
            id: true,
            url: true,
          },
        },
        Field: true,
        Recipient: true,
        directLink: {
          select: {
            token: true,
            enabled: true,
          },
        },
      },
      skip: Math.max(page - 1, 0) * perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.template.count({
      where: whereFilter,
    }),
  ]);

  return {
    templates,
    totalPages: Math.ceil(count / perPage),
  };
};
