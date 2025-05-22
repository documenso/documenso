import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export interface GetFieldsForDocumentOptions {
  documentId: number;
  userId: number;
  teamId: number;
}

export type DocumentField = Awaited<ReturnType<typeof getFieldsForDocument>>[number];

export const getFieldsForDocument = async ({
  documentId,
  userId,
  teamId,
}: GetFieldsForDocumentOptions) => {
  const fields = await prisma.field.findMany({
    where: {
      document: {
        id: documentId,
        team: buildTeamWhereQuery(teamId, userId),
      },
    },
    include: {
      signature: true,
      recipient: {
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
