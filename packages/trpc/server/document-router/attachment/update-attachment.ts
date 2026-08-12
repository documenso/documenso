import { updateAttachment } from '@documenso/lib/server-only/envelope-attachment/update-attachment';

import { ZGenericSuccessResponse } from '../../schema';
import { authenticatedProcedure } from '../../trpc';
import { ZUpdateAttachmentRequestSchema, ZUpdateAttachmentResponseSchema } from './update-attachment.types';

export const updateAttachmentRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/document/attachment/update',
      summary: 'Update attachment',
      description:
        'Deprecated: this endpoint is being replaced by the Envelope API. See https://docs.documenso.com/docs/developers/api/migrate-to-envelopes for the migration guide. Update an existing attachment',
      tags: ['Document'],
      deprecated: true,
    },
  })
  .input(ZUpdateAttachmentRequestSchema)
  .output(ZUpdateAttachmentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const userId = ctx.user.id;

    const { id, data } = input;

    ctx.logger.info({
      input: { id },
    });

    await updateAttachment({
      id,
      userId,
      teamId,
      data,
    });

    return ZGenericSuccessResponse;
  });
