import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type FindTemplateAttachmentsOptions = {
  templateId: number;
  userId: number;
  teamId: number;
};

export const findTemplateAttachments = async ({
  templateId,
  userId,
  teamId,
}: FindTemplateAttachmentsOptions) => {
  const attachments = await prisma.attachment.findMany({
    where: {
      template: {
        id: templateId,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
  });

  console.log('attachments', attachments);

  return attachments;
};
