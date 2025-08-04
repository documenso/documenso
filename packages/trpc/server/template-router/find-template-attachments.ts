import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetTemplateAttachmentsResponseSchema,
  ZGetTemplateAttachmentsSchema,
} from './find-template-attachments.types';

export const findTemplateAttachmentsRoute = authenticatedProcedure
  .input(ZGetTemplateAttachmentsSchema)
  .output(ZGetTemplateAttachmentsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { templateId } = input;

    const attachments = await findTemplateAttachments({
      templateId,
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });

    return attachments;
  });

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

  return attachments;
};
