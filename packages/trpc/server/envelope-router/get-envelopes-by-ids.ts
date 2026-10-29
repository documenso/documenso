import { getEnvelopesByIds } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  getEnvelopesByIdsMeta,
  ZGetEnvelopesByIdsRequestSchema,
  ZGetEnvelopesByIdsResponseSchema,
} from './get-envelopes-by-ids.types';

export const getEnvelopesByIdsRoute = authenticatedProcedure
  .meta(getEnvelopesByIdsMeta)
  .input(ZGetEnvelopesByIdsRequestSchema)
  .output(ZGetEnvelopesByIdsResponseSchema)
  .use(
    twoFactorScope((input) => {
      switch (input.ids.type) {
        case 'envelopeId':
          return { envelope: input.ids.ids };
        case 'documentId':
          return { document: input.ids.ids };
        case 'templateId':
          return { template: input.ids.ids };
      }
    }),
  )
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
