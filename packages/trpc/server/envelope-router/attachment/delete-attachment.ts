import { deleteAttachment } from '@documenso/lib/server-only/envelope-attachment/delete-attachment';

import { ZGenericSuccessResponse } from '../../schema';
import { authenticatedProcedure } from '../../trpc';
import { twoFactorScope } from '../../two-factor-enforcement/enforce';
import {
  deleteAttachmentMeta,
  ZDeleteAttachmentRequestSchema,
  ZDeleteAttachmentResponseSchema,
} from './delete-attachment.types';

export const deleteAttachmentRoute = authenticatedProcedure
  .meta(deleteAttachmentMeta)
  .input(ZDeleteAttachmentRequestSchema)
  .output(ZDeleteAttachmentResponseSchema)
  .use(twoFactorScope((input) => ({ attachment: input.id })))
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
