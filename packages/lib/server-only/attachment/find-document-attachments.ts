import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type FindDocumentAttachmentsOptions = {
  documentId?: number;
  userId: number;
  teamId: number;
};

export const findDocumentAttachments = async ({
  documentId,
  userId,
  teamId,
}: FindDocumentAttachmentsOptions) => {
  const attachments = await prisma.attachment.findMany({
    where: {
      document: {
        id: documentId,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
  });

  return attachments;
};
