import { resendDocument } from '@documenso/lib/server-only/document/resend-document';

import { authenticatedProcedure } from '../trpc';
import {
  ZRedistributeEnvelopeRequestSchema,
  ZRedistributeEnvelopeResponseSchema,
} from './redistribute-envelope.types';

export const redistributeEnvelopeRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/redistribute',
      summary: 'Redistribute envelope',
      description:
        'Redistribute the envelope to the provided recipients who have not actioned the envelope. Will use the distribution method set in the envelope',
      tags: ['Envelope'],
    },
  })
  .input(ZRedistributeEnvelopeRequestSchema)
  .output(ZRedistributeEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, recipients } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        recipients,
      },
    });

    await resendDocument({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      recipients,
      requestMetadata: ctx.metadata,
    });
  });
