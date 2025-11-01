import { duplicateEnvelope } from '@documenso/lib/server-only/envelope/duplicate-envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZDuplicateEnvelopeRequestSchema,
  ZDuplicateEnvelopeResponseSchema,
} from './duplicate-envelope.types';

export const duplicateEnvelopeRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/duplicate',
      summary: 'Duplicate envelope',
      description: 'Duplicate an envelope with all its settings',
      tags: ['Envelope'],
    },
  })
  .input(ZDuplicateEnvelopeRequestSchema)
  .output(ZDuplicateEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const duplicatedEnvelope = await duplicateEnvelope({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
    });

    return {
      duplicatedEnvelopeId: duplicatedEnvelope.id,
    };
  });
