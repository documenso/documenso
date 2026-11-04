import { updateAttachment } from '@documenso/lib/server-only/envelope-attachment/update-attachment';

import { ZGenericSuccessResponse } from '../../schema';
import { authenticatedProcedure } from '../../trpc';
import { twoFactorScope } from '../../two-factor-enforcement/enforce';
import {
  updateAttachmentMeta,
  ZUpdateAttachmentRequestSchema,
  ZUpdateAttachmentResponseSchema,
} from './update-attachment.types';

export const updateAttachmentRoute = authenticatedProcedure
  .meta(updateAttachmentMeta)
  .input(ZUpdateAttachmentRequestSchema)
  .output(ZUpdateAttachmentResponseSchema)
  .use(twoFactorScope((input) => ({ attachment: input.id })))
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
