import { prisma } from '@documenso/prisma';

export interface GetFieldsForDocumentOptions {
  documentId: number;
  userId: number;
}

export const getFieldsForDocument = async ({ documentId, userId }: GetFieldsForDocumentOptions) => {
  const fields = await prisma.field.findMany({
    where: {
      documentId,
      Document: {
<<<<<<< HEAD
        userId,
=======
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
>>>>>>> main
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return fields;
};
