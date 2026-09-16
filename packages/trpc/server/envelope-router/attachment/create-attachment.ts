import { createAttachment } from '@documenso/lib/server-only/envelope-attachment/create-attachment';

import { authenticatedProcedure } from '../../trpc';
import { twoFactorScope } from '../../two-factor-enforcement/enforce';
import {
  createAttachmentMeta,
  ZCreateAttachmentRequestSchema,
  ZCreateAttachmentResponseSchema,
} from './create-attachment.types';

export const createAttachmentRoute = authenticatedProcedure
  .meta(createAttachmentMeta)
  .input(ZCreateAttachmentRequestSchema)
  .output(ZCreateAttachmentResponseSchema)
  .use(twoFactorScope((input) => ({ envelope: input.envelopeId })))
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const userId = ctx.user.id;

    const { envelopeId, data } = input;

    ctx.logger.info({
      input: { envelopeId, label: data.label },
    });

    const attachment = await createAttachment({
      envelopeId,
      teamId,
      userId,
      data,
    });

    return {
      id: attachment.id,
    };
  });
