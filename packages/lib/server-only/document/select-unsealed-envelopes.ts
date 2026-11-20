import { kyselyPrisma, sql } from '@documenso/prisma';
import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';

/**
 * Selects the documents that should have been sealed but were not. The seal
 * sweep retries them and the admin panel lists them, so both start from here.
 *
 * A document is waiting to be sealed when it is either:
 *   1. PENDING, and all recipients are SIGNED or have role CC (normal completion)
 *   2. PENDING, and any recipient has REJECTED (a rejection recorded before
 *      rejecting set the envelope status itself)
 *   3. REJECTED without a `completedAt`. Rejecting sets the status immediately,
 *      but only the seal job stamps the PDF and sets `completedAt`. The status is
 *      enough: the recipient who rejected may since have been edited or removed.
 */
export const selectUnsealedEnvelopes = () => {
  return (
    kyselyPrisma.$kysely
      .selectFrom('Envelope')
      .where('Envelope.type', '=', sql.lit(EnvelopeType.DOCUMENT))
      .where('Envelope.deletedAt', 'is', null)
      // Ensure there is at least one recipient.
      .where((eb) => eb.exists(eb.selectFrom('Recipient').whereRef('Recipient.envelopeId', '=', 'Envelope.id')))
      .where((eb) =>
        eb.or([
          eb.and([
            eb('Envelope.status', '=', sql.lit(DocumentStatus.PENDING)),
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
          ]),
          // Case 3: The envelope is REJECTED and not sealed yet.
          eb.and([
            eb('Envelope.status', '=', sql.lit(DocumentStatus.REJECTED)),
            eb('Envelope.completedAt', 'is', null),
          ]),
        ]),
      )
  );
};
