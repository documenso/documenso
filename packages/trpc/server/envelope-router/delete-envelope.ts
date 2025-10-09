import { deleteEnvelope } from '@documenso/lib/server-only/envelope/delete-envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteEnvelopeRequestSchema,
  ZDeleteEnvelopeResponseSchema,
} from './delete-envelope.types';

export const deleteEnvelopeRoute = authenticatedProcedure
  // .meta(deleteEnvelopeMeta)
  .input(ZDeleteEnvelopeRequestSchema)
  .output(ZDeleteEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const userId = ctx.user.id;

    await deleteEnvelope({
      id: envelopeId,
      userId,
      teamId,
      requestMetadata: ctx.metadata,
    });
  });
