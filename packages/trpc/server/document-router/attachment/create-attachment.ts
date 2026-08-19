import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';

import { createAttachment } from '@documenso/lib/server-only/envelope-attachment/create-attachment';
import { EnvelopeType } from '@prisma/client';

import { authenticatedProcedure } from '../../trpc';
import { ZCreateAttachmentRequestSchema, ZCreateAttachmentResponseSchema } from './create-attachment.types';

export const createAttachmentRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/document/attachment/create',
      summary: 'Create attachment',
      description:
        'Deprecated: this endpoint is being replaced by the Envelope API. See https://docs.documenso.com/docs/developers/api/migrate-to-envelopes for the migration guide. Create a new attachment for a document',
      tags: ['Document'],
      deprecated: true,
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
