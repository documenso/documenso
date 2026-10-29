import { duplicateEnvelope } from '@documenso/lib/server-only/envelope/duplicate-envelope';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  duplicateEnvelopeMeta,
  ZDuplicateEnvelopeRequestSchema,
  ZDuplicateEnvelopeResponseSchema,
} from './duplicate-envelope.types';

export const duplicateEnvelopeRoute = authenticatedProcedure
  .meta(duplicateEnvelopeMeta)
  .input(ZDuplicateEnvelopeRequestSchema)
  .output(ZDuplicateEnvelopeResponseSchema)
  .use(twoFactorScope((input) => ({ envelope: input.envelopeId })))
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, includeRecipients, includeFields } = input;

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
      overrides: {
        includeRecipients,
        includeFields,
      },
    });

    return {
      id: duplicatedEnvelope.id,
    };
  });
