import { updateEnvelopeRecipients } from '@documenso/lib/server-only/recipient/update-envelope-recipients';

import { authenticatedProcedure } from '../../trpc';
import {
  ZUpdateEnvelopeRecipientsRequestSchema,
  ZUpdateEnvelopeRecipientsResponseSchema,
} from './update-envelope-recipients.types';

export const updateEnvelopeRecipientsRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/recipient/update-many',
      summary: 'Update envelope recipients',
      description: 'Update multiple recipients for an envelope',
      tags: ['Envelope Recipient'],
    },
  })
  .input(ZUpdateEnvelopeRecipientsRequestSchema)
  .output(ZUpdateEnvelopeRecipientsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { envelopeId, data: recipients } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    return await updateEnvelopeRecipients({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      recipients,
      requestMetadata: ctx.metadata,
    });
  });
