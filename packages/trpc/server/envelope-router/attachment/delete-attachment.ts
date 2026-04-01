import { deleteAttachment } from '@documenso/lib/server-only/envelope-attachment/delete-attachment';

import { ZGenericSuccessResponse } from '../../schema';
import { authenticatedProcedure } from '../../trpc';
import {
  ZDeleteAttachmentRequestSchema,
  ZDeleteAttachmentResponseSchema,
  deleteAttachmentMeta,
} from './delete-attachment.types';

export const deleteAttachmentRoute = authenticatedProcedure
  .meta(deleteAttachmentMeta)
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

    return ZGenericSuccessResponse;
  });
