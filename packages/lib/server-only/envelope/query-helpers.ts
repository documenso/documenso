import { sql } from '@documenso/prisma';
import type { DB } from '@documenso/prisma/generated/types';
import { RecipientRole, SigningStatus } from '@prisma/client';
import type { ExpressionBuilder } from 'kysely';

// Expression builder type scoped to the Envelope table context.
type EnvelopeExpressionBuilder = ExpressionBuilder<DB, 'Envelope'>;

/**
 * Reusable EXISTS subquery: checks that the envelope has at least one recipient whose
 * signing link has expired — `expiresAt` in the past, still unsigned, and not a CC.
 *
 * This is the single source of truth for the "expired recipient" predicate used by
 * `findDocuments`, `findEnvelopes`, and `getStats`. It must stay in sync with
 * `isRecipientExpired` (packages/lib/utils/recipients.ts).
 */
export const hasExpiredRecipient = (eb: EnvelopeExpressionBuilder) =>
  eb.exists(
    eb
      .selectFrom('Recipient')
      .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
      .where('Recipient.expiresAt', 'is not', null)
      .where('Recipient.expiresAt', '<=', new Date())
      .where('Recipient.signingStatus', '=', sql.lit(SigningStatus.NOT_SIGNED))
      .where('Recipient.role', '!=', sql.lit(RecipientRole.CC))
      .select(sql.lit(1).as('one')),
  );
