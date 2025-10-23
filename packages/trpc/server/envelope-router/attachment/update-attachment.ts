import { updateAttachment } from '@documenso/lib/server-only/envelope-attachment/update-attachment';

import { authenticatedProcedure } from '../../trpc';
import {
  ZUpdateAttachmentRequestSchema,
  ZUpdateAttachmentResponseSchema,
} from './update-attachment.types';

export const updateAttachmentRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/attachment/update',
      summary: 'Update attachment',
      description: 'Update an existing attachment',
      tags: ['Envelope'],
    },
  })
  .input(ZUpdateAttachmentRequestSchema)
  .output(ZUpdateAttachmentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const userId = ctx.user.id;

    const { id, label, data } = input;

    ctx.logger.info({
      input: { id },
    });

    await updateAttachment({
      id,
      userId,
      teamId,
      label,
      data,
    });
  });
