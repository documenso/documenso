import { deleteAttachment } from '@documenso/lib/server-only/envelope-attachment/delete-attachment';

import { authenticatedProcedure } from '../../trpc';
import {
  ZDeleteAttachmentRequestSchema,
  ZDeleteAttachmentResponseSchema,
} from './delete-attachment.types';

export const deleteAttachmentRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/attachment/delete',
      summary: 'Delete attachment',
      description: 'Delete an attachment from an envelope',
      tags: ['Envelope Attachments'],
    },
  })
  .input(ZDeleteAttachmentRequestSchema)
  .output(ZDeleteAttachmentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const userId = ctx.user.id;

    const { id } = input;

    ctx.logger.info({
      input: { id },
    });

    await deleteAttachment({
      id,
      userId,
      teamId,
    });
  });
