import { type DocumentStatus, Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

// Shorter than the 10s interactive transaction timeout (packages/prisma/index.ts), so a request
// queued behind a slow holder fails with a 409 here rather than with a 500 from the transaction
// timeout, and still has time for its own writes once it gets the lock.
const ENVELOPE_LOCK_TIMEOUT = '5s';

const POSTGRES_LOCK_NOT_AVAILABLE = '55P03';

type LockedEnvelope = {
  id: string;
  status: DocumentStatus;
  signatureLevel: string;
  deletedAt: Date | null;
};

/**
 * Locks the envelope row until the transaction ends and returns its current state. Signing,
 * completing, rejecting, sending and authoring all take it, so they run one at a time per
 * envelope. Anything read before the lock may be stale: decide from reads made after it.
 *
 * `FOR NO KEY UPDATE`, not `FOR UPDATE`: inserting a row which references the envelope (audit
 * logs, fields, recipients) takes `FOR KEY SHARE` on it, which `FOR UPDATE` blocks. That
 * deadlocked a field update with a signer holding the envelope.
 *
 * Must be the first statement of the transaction, and the only way an envelope row is locked.
 * A later lock or a second lock mode can deadlock, and a raw lock has no timeout.
 */
export const lockEnvelope = async (tx: Prisma.TransactionClient, envelopeId: string): Promise<LockedEnvelope> => {
  await tx.$executeRaw`SELECT set_config('lock_timeout', ${ENVELOPE_LOCK_TIMEOUT}, true)`;

  const rows = await tx.$queryRaw<LockedEnvelope[]>`
    SELECT "id", "status", "signatureLevel", "deletedAt"
    FROM "Envelope"
    WHERE "id" = ${envelopeId}
    FOR NO KEY UPDATE
  `.catch((error: unknown) => {
    const isLockTimeout =
      error instanceof Prisma.PrismaClientKnownRequestError && error.meta?.code === POSTGRES_LOCK_NOT_AVAILABLE;

    if (isLockTimeout) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Envelope ${envelopeId} is being changed by another request, try again`,
        statusCode: 409,
      });
    }

    throw error;
  });

  // The timeout is only meant for this lock. Prisma does not map a lock timeout raised by a
  // later query of the transaction, which would surface as a 500.
  await tx.$executeRaw`SET LOCAL lock_timeout TO DEFAULT`;

  const envelope = rows[0];

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Envelope ${envelopeId} not found`,
    });
  }

  return envelope;
};
