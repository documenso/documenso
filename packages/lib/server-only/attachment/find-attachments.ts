import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type FindAttachmentsOptions = {
  documentId: number;
  userId: number;
  teamId: number;
};

export const findAttachments = async ({ documentId, userId, teamId }: FindAttachmentsOptions) => {
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
