import { prisma } from '@documenso/prisma';

export interface GetFieldsForDocumentOptions {
  documentId: number;
  userId: number;
}

export type DocumentField = Awaited<ReturnType<typeof getFieldsForDocument>>[number];

export const getFieldsForDocument = async ({ documentId, userId }: GetFieldsForDocumentOptions) => {
  const fields = await prisma.field.findMany({
    where: {
      documentId,
      Document: {
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
    include: {
      Signature: true,
      Recipient: {
        select: {
          name: true,
          email: true,
          signingStatus: true,
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return fields;
};
