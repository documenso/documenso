import { updateAttachment } from '@documenso/lib/server-only/envelope-attachment/update-attachment';

import { ZGenericSuccessResponse } from '../../schema';
import { authenticatedProcedure } from '../../trpc';
import {
  ZUpdateAttachmentRequestSchema,
  ZUpdateAttachmentResponseSchema,
  updateAttachmentMeta,
} from './update-attachment.types';

export const updateAttachmentRoute = authenticatedProcedure
  .meta(updateAttachmentMeta)
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
