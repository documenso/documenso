import { getEnvelopesByIds } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetEnvelopesByIdsRequestSchema,
  ZGetEnvelopesByIdsResponseSchema,
  getEnvelopesByIdsMeta,
} from './get-envelopes-by-ids.types';

export const getEnvelopesByIdsRoute = authenticatedProcedure
  .meta(getEnvelopesByIdsMeta)
  .input(ZGetEnvelopesByIdsRequestSchema)
  .output(ZGetEnvelopesByIdsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { ids } = input;

    ctx.logger.info({
      input: {
        ids,
      },
    });

    const envelopes = await getEnvelopesByIds({
      ids,
      userId: user.id,
      teamId,
      type: null,
    });

    return {
      data: envelopes,
    };
  });
