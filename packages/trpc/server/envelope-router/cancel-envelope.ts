import { cancelDocument } from '@documenso/lib/server-only/document/cancel-document';

import { ZGenericSuccessResponse } from '../schema';
import { authenticatedProcedure } from '../trpc';
import {
  cancelEnvelopeMeta,
  ZCancelEnvelopeRequestSchema,
  ZCancelEnvelopeResponseSchema,
} from './cancel-envelope.types';

export const cancelEnvelopeRoute = authenticatedProcedure
  .meta(cancelEnvelopeMeta)
  .input(ZCancelEnvelopeRequestSchema)
  .output(ZCancelEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, reason } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    await cancelDocument({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      userId: ctx.user.id,
      teamId,
      reason,
      requestMetadata: ctx.metadata,
    });

    return ZGenericSuccessResponse;
  });
