import type { Envelope, Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canContentBeChanged } from '../../utils/envelope';
import { lockEnvelope } from '../envelope/lock-envelope';

/**
 * Contents are rendered into the PDF when the envelope is sent, so from then on
 * the rows must stay as they were rendered.
 *
 * Call this twice at every content mutation: once outside the transaction to
 * fail fast, and once inside with `tx`, which locks the envelope row.
 * `sendDocument` takes the same lock in the transaction which commits the
 * rendered PDF (`assertEnvelopeContentsUnchanged`), so one of the two always
 * observes the other's committed state: either this sees PENDING and refuses,
 * or the send sees the changed contents and aborts.
 */
export const assertContentCanBeChanged = async (
  envelope: Pick<Envelope, 'id' | 'status'>,
  tx?: Prisma.TransactionClient,
) => {
  const current = tx ? await lockEnvelope(tx, envelope.id) : envelope;

  if (canContentBeChanged(current)) {
    return;
  }

  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: 'Contents can no longer be modified for this envelope',
  });
};
