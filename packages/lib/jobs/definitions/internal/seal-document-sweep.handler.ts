import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';

import { kyselyPrisma, sql } from '@documenso/prisma';

import { mapSecondaryIdToDocumentId } from '../../../utils/envelope';
import { jobs } from '../../client';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSealDocumentSweepJobDefinition } from './seal-document-sweep';

export const run = async ({ io }: { payload: TSealDocumentSweepJobDefinition; io: JobRunIO }) => {
  const now = DateTime.now();
  const fifteenMinutesAgo = now.minus({ minutes: 15 }).toJSDate();

  // Find all PENDING envelopes that should have been sealed but weren't.
  // The 15-minute lower bound avoids racing with the normal seal-document job.
  // No upper bound — if the initial seal trigger was dropped (150ms timeout in
  // local job provider), the sweep must keep retrying. The seal job's own
  // maxRetries handles truly broken PDFs.
  const unsealedEnvelopes = await kyselyPrisma.$kysely
    .selectFrom('Envelope')
    .select(['Envelope.id', 'Envelope.secondaryId'])
    .where('Envelope.status', '=', sql.lit(DocumentStatus.PENDING))
    .where('Envelope.type', '=', sql.lit(EnvelopeType.DOCUMENT))
    .where('Envelope.deletedAt', 'is', null)
    // Ensure there is at least one recipient.
    .where((eb) =>
      eb.exists(eb.selectFrom('Recipient').whereRef('Recipient.envelopeId', '=', 'Envelope.id')),
    )
    // Document is ready to seal: all recipients are SIGNED/CC, or any recipient REJECTED.
    .where((eb) =>
      eb.or([
        // Case 1: All recipients are either SIGNED or CC.
        eb.not(
          eb.exists(
            eb
              .selectFrom('Recipient')
              .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
              .where('Recipient.signingStatus', '!=', sql.lit(SigningStatus.SIGNED))
              .where('Recipient.role', '!=', sql.lit(RecipientRole.CC)),
          ),
        ),
        // Case 2: Any recipient has rejected.
        eb.exists(
          eb
            .selectFrom('Recipient')
            .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
            .where('Recipient.signingStatus', '=', sql.lit(SigningStatus.REJECTED)),
        ),
      ]),
    )
    // Exclude envelopes where a recipient signed/rejected within the last 15 minutes
    // to avoid racing with the standard completion flow.
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('Recipient')
            .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
            .where('Recipient.signedAt', '>', fifteenMinutesAgo),
        ),
      ),
    )
    .limit(100)
    .execute();

  if (unsealedEnvelopes.length === 0) {
    io.logger.info('No unsealed documents found');
    return;
  }

  io.logger.info(`Found ${unsealedEnvelopes.length} unsealed documents`);

  await Promise.allSettled(
    unsealedEnvelopes.map(async (envelope) => {
      const documentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

      io.logger.info(`Triggering seal for document ${documentId} (${envelope.id})`);

      await jobs.triggerJob({
        name: 'internal.seal-document',
        payload: {
          documentId,
          isResealing: true,
        },
      });
    }),
  );
};
