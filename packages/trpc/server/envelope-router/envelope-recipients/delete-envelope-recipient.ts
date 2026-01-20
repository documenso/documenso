import { deleteEnvelopeRecipient } from '@documenso/lib/server-only/recipient/delete-envelope-recipient';

import { ZGenericSuccessResponse } from '../../schema';
import { authenticatedProcedure } from '../../trpc';
import {
  ZDeleteEnvelopeRecipientRequestSchema,
  ZDeleteEnvelopeRecipientResponseSchema,
  deleteEnvelopeRecipientMeta,
} from './delete-envelope-recipient.types';

export const deleteEnvelopeRecipientRoute = authenticatedProcedure
  .meta(deleteEnvelopeRecipientMeta)
  .input(ZDeleteEnvelopeRecipientRequestSchema)
  .output(ZDeleteEnvelopeRecipientResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { recipientId } = input;

    ctx.logger.info({
      input: {
        recipientId,
      },
    });

    await deleteEnvelopeRecipient({
      userId: user.id,
      teamId,
      recipientId,
      requestMetadata: metadata,
    });

    return ZGenericSuccessResponse;
  });
