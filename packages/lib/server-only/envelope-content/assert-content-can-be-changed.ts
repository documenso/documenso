import type { DocumentStatus, Envelope, Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canContentBeChanged } from '../../utils/envelope';

/**
 * Reject a content mutation once the envelope has left DRAFT.
 *
 * Contents are rendered into the PDF when the envelope is sent, so from then
 * on the rows must stay as they were rendered or they no longer describe the
 * document. Templates are never sent and stay editable.
 *
 * Call this twice at every content mutation, in the same way as
 * `assertEnvelopeMutable`:
 *
 * 1. Outside the transaction, which checks the pre-fetched status to fail
 *    fast without a round trip.
 * 2. Inside the transaction with `tx`, which locks the envelope row and
 *    re-reads the status under that lock.
 *
 * The lock is what makes the second check sound. `sendDocument` takes the
 * same lock in the transaction which commits the rendered PDF (see
 * `assertEnvelopeContentsUnchanged`), so one of the two always observes the
 * other's committed state: either this sees PENDING and refuses, or the send
 * sees the changed contents and aborts. Without the lock both could read
 * before either commits and the rows would end up disagreeing with the PDF.
 */
export const assertContentCanBeChanged = async (
  envelope: Pick<Envelope, 'id' | 'status'>,
  tx?: Prisma.TransactionClient,
) => {
  let current: Pick<Envelope, 'status'> = envelope;

  // Lock the envelope row if a transaction is provided and re-read its status.
  if (tx) {
    const rows = await tx.$queryRaw<
      { status: DocumentStatus }[]
    >`SELECT "status" FROM "Envelope" WHERE "id" = ${envelope.id} FOR UPDATE`;

    const row = rows[0];

    if (!row) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    current = row;
  }

  if (canContentBeChanged(current)) {
    return;
  }

  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: 'Contents can no longer be modified for this envelope',
  });
};
