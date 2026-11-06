import type { DocumentStatus, Envelope, Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canContentBeChanged } from '../../utils/envelope';

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
  let current: Pick<Envelope, 'status'> = envelope;

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
