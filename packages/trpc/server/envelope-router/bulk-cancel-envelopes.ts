import { cancelDocument } from '@documenso/lib/server-only/document/cancel-document';
import { getMultipleEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';
import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';
import pMap from 'p-map';

import { authenticatedProcedure } from '../trpc';
import { ZBulkCancelEnvelopesRequestSchema, ZBulkCancelEnvelopesResponseSchema } from './bulk-cancel-envelopes.types';

export const bulkCancelEnvelopesRoute = authenticatedProcedure
  .input(ZBulkCancelEnvelopesRequestSchema)
  .output(ZBulkCancelEnvelopesResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeIds, reason } = input;

    ctx.logger.info({
      input: {
        envelopeIds,
      },
    });

    // Cancelling only applies to documents. Templates are filtered out here so
    // selecting a template never counts towards a cancellation.
    const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'envelopeId',
        ids: envelopeIds,
      },
      userId: user.id,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    const envelopes = await prisma.envelope.findMany({
      where: envelopeWhereInput,
      select: {
        id: true,
      },
    });

    const results = await pMap(
      envelopes,
      async (envelope) => {
        const { id: envelopeId } = envelope;

        try {
          await cancelDocument({
            id: {
              type: 'envelopeId',
              id: envelopeId,
            },
            userId: user.id,
            teamId,
            reason,
            requestMetadata: ctx.metadata,
          });

          return {
            success: true,
            envelopeId,
          };
        } catch (err) {
          ctx.logger.warn(
            {
              envelopeId,
              error: err,
            },
            'Failed to cancel envelope during bulk cancel',
          );

          return {
            success: false,
            envelopeId,
          };
        }
      },
      {
        concurrency: 10,
        stopOnError: false,
      },
    );

    const cancelledCount = results.filter((r) => r.success).length;
    const failedIds = results.filter((r) => !r.success).map((r) => r.envelopeId);

    // Include envelope IDs that were not attempted (unauthorized/not found/not a document).
    const attemptedIds = new Set(envelopes.map((e) => e.id));
    const unattemptedIds = envelopeIds.filter((id) => !attemptedIds.has(id));

    return {
      cancelledCount,
      failedIds: [...failedIds, ...unattemptedIds],
    };
  });
