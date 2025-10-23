import { EnvelopeType } from '@prisma/client';

import { findAttachmentsByEnvelopeId } from '@documenso/lib/server-only/envelope-attachment/find-attachments-by-envelope-id';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';

import { authenticatedProcedure } from '../../trpc';
import {
  ZFindAttachmentsRequestSchema,
  ZFindAttachmentsResponseSchema,
} from './find-attachments.types';

export const findAttachmentsRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/document/attachment',
      summary: 'Find attachments',
      description: 'Find all attachments for a document',
      tags: ['Document'],
    },
  })
  .input(ZFindAttachmentsRequestSchema)
  .output(ZFindAttachmentsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { documentId } = input;
    const { teamId } = ctx;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: { documentId },
    });

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: documentId,
      },
      userId,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    const data = await findAttachmentsByEnvelopeId({
      envelopeId: envelope.id,
      teamId,
      userId,
    });

    return {
      data,
    };
  });
