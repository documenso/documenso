import { prisma } from '@documenso/prisma';

export interface GetFieldsForTemplateOptions {
  templateId: number;
  userId: number;
}

export const getFieldsForTemplate = async ({ templateId, userId }: GetFieldsForTemplateOptions) => {
  const fields = await prisma.field.findMany({
    where: {
      templateId,
      Template: {
        OR: [
          {
            userId,
          },
          {
            team: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        ],
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return fields;
};
