import { prisma } from '@documenso/prisma';

export type GetFieldByIdOptions = {
  userId: number;
  teamId?: number;
  fieldId: number;
  documentId?: number;
  templateId?: number;
};

export const getFieldById = async ({
  userId,
  teamId,
  fieldId,
  documentId,
  templateId,
}: GetFieldByIdOptions) => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      documentId,
      templateId,
      Document: {
        OR:
          teamId === undefined
            ? [
                {
                  userId,
                  teamId: null,
                },
              ]
            : [
                {
                  teamId,
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
  });

  return field;
};
