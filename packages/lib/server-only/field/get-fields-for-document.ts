import { prisma } from '@documenso/prisma';

export interface GetFieldsForDocumentOptions {
  documentId: number;
  userId: number;
  teamId?: number;
}

export type DocumentField = Awaited<ReturnType<typeof getFieldsForDocument>>[number];

export const getFieldsForDocument = async ({
  documentId,
  userId,
  teamId,
}: GetFieldsForDocumentOptions) => {
  const fields = await prisma.field.findMany({
    where: {
      documentId,
      Document: teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
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
