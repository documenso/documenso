import { createEnvelopeRecipients } from '@documenso/lib/server-only/recipient/create-envelope-recipients';

import { authenticatedProcedure } from '../../trpc';
import {
  ZCreateEnvelopeRecipientsRequestSchema,
  ZCreateEnvelopeRecipientsResponseSchema,
} from './create-envelope-recipients.types';

export const createEnvelopeRecipientsRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/recipient/create-many',
      summary: 'Create envelope recipients',
      description: 'Create multiple recipients for an envelope',
      tags: ['Envelope Recipients'],
    },
  })
  .input(ZCreateEnvelopeRecipientsRequestSchema)
  .output(ZCreateEnvelopeRecipientsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { envelopeId, data: recipients } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    return await createEnvelopeRecipients({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      recipients,
      requestMetadata: metadata,
    });
  });
