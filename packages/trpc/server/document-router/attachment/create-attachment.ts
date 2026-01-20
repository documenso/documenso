import { EnvelopeType } from '@prisma/client';

import { createAttachment } from '@documenso/lib/server-only/envelope-attachment/create-attachment';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';

import { authenticatedProcedure } from '../../trpc';
import {
  ZCreateAttachmentRequestSchema,
  ZCreateAttachmentResponseSchema,
} from './create-attachment.types';

export const createAttachmentRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/document/attachment/create',
      summary: 'Create attachment',
      description: 'Create a new attachment for a document',
      tags: ['Document'],
    },
  })
  .input(ZCreateAttachmentRequestSchema)
  .output(ZCreateAttachmentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const userId = ctx.user.id;

    const { documentId, data } = input;

    ctx.logger.info({
      input: { documentId, label: data.label },
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

    const attachment = await createAttachment({
      envelopeId: envelope.id,
      teamId,
      userId,
      data,
    });

    return {
      id: attachment.id,
    };
  });
