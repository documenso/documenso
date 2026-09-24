import { duplicateEnvelope } from '@documenso/lib/server-only/envelope/duplicate-envelope';

import { authenticatedProcedure } from '../trpc';
import {
  duplicateEnvelopeMeta,
  ZDuplicateEnvelopeRequestSchema,
  ZDuplicateEnvelopeResponseSchema,
} from './duplicate-envelope.types';

export const duplicateEnvelopeRoute = authenticatedProcedure
  .meta(duplicateEnvelopeMeta)
  .input(ZDuplicateEnvelopeRequestSchema)
  .output(ZDuplicateEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, includeRecipients, includeFields, includeContents } = input;

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
        includeContents,
      },
    });

    return {
      id: duplicatedEnvelope.id,
    };
  });
