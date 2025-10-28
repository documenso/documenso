import { createAttachment } from '@documenso/lib/server-only/envelope-attachment/create-attachment';

import { authenticatedProcedure } from '../../trpc';
import {
  ZCreateAttachmentRequestSchema,
  ZCreateAttachmentResponseSchema,
} from './create-attachment.types';

export const createAttachmentRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/attachment/create',
      summary: 'Create attachment',
      description: 'Create a new attachment for an envelope',
      tags: ['Envelope'],
    },
  })
  .input(ZCreateAttachmentRequestSchema)
  .output(ZCreateAttachmentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const userId = ctx.user.id;

    const { envelopeId, data } = input;

    ctx.logger.info({
      input: { envelopeId, label: data.label },
    });

    await createAttachment({
      envelopeId,
      teamId,
      userId,
      data,
    });
  });
