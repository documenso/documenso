import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetDocumentAttachmentsResponseSchema,
  ZGetDocumentAttachmentsSchema,
} from './find-document-attachments.types';

export const findDocumentAttachmentsRoute = authenticatedProcedure
  .input(ZGetDocumentAttachmentsSchema)
  .output(ZGetDocumentAttachmentsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { documentId } = input;
    const { user } = ctx;

    const attachments = await findDocumentAttachments({
      documentId,
      userId: user.id,
      teamId: ctx.teamId,
    });

    return attachments;
  });

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
