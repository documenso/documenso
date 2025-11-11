import { updateEnvelope } from '@documenso/lib/server-only/envelope/update-envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateEnvelopeRequestSchema,
  ZUpdateEnvelopeResponseSchema,
  updateEnvelopeMeta,
} from './update-envelope.types';

export const updateEnvelopeRoute = authenticatedProcedure
  .meta(updateEnvelopeMeta)
  .input(ZUpdateEnvelopeRequestSchema)
  .output(ZUpdateEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, data, meta = {} } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const userId = ctx.user.id;

    return await updateEnvelope({
      userId,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      data,
      meta,
      requestMetadata: ctx.metadata,
    });
  });
