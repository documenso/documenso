import { deleteEnvelopeRecipient } from '@documenso/lib/server-only/recipient/delete-envelope-recipient';

import { authenticatedProcedure } from '../../trpc';
import {
  ZDeleteEnvelopeRecipientRequestSchema,
  ZDeleteEnvelopeRecipientResponseSchema,
} from './delete-envelope-recipient.types';

export const deleteEnvelopeRecipientRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/recipient/delete',
      summary: 'Delete envelope recipient',
      description: 'Delete an envelope recipient',
      tags: ['Envelope Recipient'],
    },
  })
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
  });
