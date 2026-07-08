import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';
import pMap from 'p-map';

import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { getMultipleEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZBulkRedistributeEnvelopesRequestSchema,
  ZBulkRedistributeEnvelopesResponseSchema,
} from './bulk-redistribute-envelopes.types';

export const bulkRedistributeEnvelopesRoute = authenticatedProcedure
  // .meta(bulkRedistributeEnvelopesMeta) // Keeping this as a private API for a little while until we're sure it's stable and the request/response schemas are finalized.
  .input(ZBulkRedistributeEnvelopesRequestSchema)
  .output(ZBulkRedistributeEnvelopesResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeIds } = input;

    ctx.logger.info({
      input: {
        envelopeIds,
      },
    });

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
        status: true,
        recipients: {
          select: {
            id: true,
            role: true,
            signingStatus: true,
          },
        },
      },
    });

    const results = await pMap(
      envelopes,
      async (envelope) => {
        const { id: envelopeId } = envelope;

        const pendingRecipientIds = envelope.recipients
          .filter(
            (recipient) =>
              recipient.signingStatus === SigningStatus.NOT_SIGNED &&
              recipient.role !== RecipientRole.CC,
          )
          .map((recipient) => recipient.id);

        // Only pending documents with at least one recipient who has not signed can be reminded.
        if (envelope.status !== DocumentStatus.PENDING || pendingRecipientIds.length === 0) {
          return {
            status: 'skipped' as const,
            envelopeId,
          };
        }

        try {
          await resendDocument({
            userId: user.id,
            teamId,
            id: {
              type: 'envelopeId',
              id: envelopeId,
            },
            recipients: pendingRecipientIds,
            requestMetadata: ctx.metadata,
          });

          return {
            status: 'resent' as const,
            envelopeId,
          };
        } catch (err) {
          ctx.logger.warn(
            {
              envelopeId,
              error: err,
            },
            'Failed to resend envelope during bulk resend',
          );

          return {
            status: 'failed' as const,
            envelopeId,
          };
        }
      },
      {
        concurrency: 10,
        stopOnError: false,
      },
    );

    const resentCount = results.filter((r) => r.status === 'resent').length;
    const failedIds = results.filter((r) => r.status === 'failed').map((r) => r.envelopeId);

    // Include envelope IDs that were not attempted (unauthorized/not found).
    const attemptedIds = new Set(envelopes.map((e) => e.id));
    const unattemptedIds = envelopeIds.filter((id) => !attemptedIds.has(id));

    return {
      resentCount,
      failedIds: [...failedIds, ...unattemptedIds],
    };
  });
