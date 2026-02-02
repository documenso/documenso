import { createAttachment } from '@documenso/lib/server-only/envelope-attachment/create-attachment';

import { authenticatedProcedure } from '../../trpc';
import {
  ZCreateAttachmentRequestSchema,
  ZCreateAttachmentResponseSchema,
  createAttachmentMeta,
} from './create-attachment.types';

export const createAttachmentRoute = authenticatedProcedure
  .meta(createAttachmentMeta)
  .input(ZCreateAttachmentRequestSchema)
  .output(ZCreateAttachmentResponseSchema)
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
