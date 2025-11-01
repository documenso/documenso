import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';

import { authenticatedProcedure } from '../trpc';
import { ZGetEnvelopeRequestSchema, ZGetEnvelopeResponseSchema } from './get-envelope.types';

export const getEnvelopeRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/envelope/{envelopeId}',
      summary: 'Get envelope',
      description: 'Returns an envelope given an ID',
      tags: ['Envelope'],
    },
  })
  .input(ZGetEnvelopeRequestSchema)
  .output(ZGetEnvelopeResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    return await getEnvelopeById({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
    });
  });
