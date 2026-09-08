import { updateEnvelope } from '@documenso/lib/server-only/envelope/update-envelope';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  updateEnvelopeMeta,
  ZUpdateEnvelopeRequestSchema,
  ZUpdateEnvelopeResponseSchema,
} from './update-envelope.types';

export const updateEnvelopeRoute = authenticatedProcedure
  .meta(updateEnvelopeMeta)
  .input(ZUpdateEnvelopeRequestSchema)
  .output(ZUpdateEnvelopeResponseSchema)
  .use(twoFactorScope((input) => ({ envelope: input.envelopeId })))
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
