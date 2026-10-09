import type { Envelope, Prisma } from '@prisma/client';

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
 * 2. Inside the transaction with `tx`, which re-reads the status under the
 *    transaction so a `sendDocument` committing DRAFT → PENDING between the
 *    first read and the write cannot slip a change in after the render.
 */
export const assertContentCanBeChanged = async (
  envelope: Pick<Envelope, 'id' | 'status'>,
  tx?: Prisma.TransactionClient,
) => {
  const current = tx
    ? await tx.envelope.findFirstOrThrow({
        where: {
          id: envelope.id,
        },
        select: {
          status: true,
        },
      })
    : envelope;

  if (canContentBeChanged(current)) {
    return;
  }

  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: 'Contents can no longer be modified for this envelope',
  });
};
