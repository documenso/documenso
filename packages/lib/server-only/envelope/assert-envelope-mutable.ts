import { DocumentStatus, type Envelope, type Prisma } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isTspEnvelope } from '../../types/signature-level';

type EnvelopeMutableSnapshot = {
  signatureLevel: string;
  status: DocumentStatus;
};

type EnvelopeIdRef = Pick<Envelope, 'id'>;

/**
 * Reject authoring mutations on an AES/QES envelope past DRAFT.
 *
 * The TSP mutation lock fires at distribution so the owner cannot replace the
 * PDF between a recipient completing service-scope OAuth (against PDF_v1) and
 * clicking Sign (now against PDF_v2). The SAD would authorise PDF_v2's digest
 * while the recipient viewed PDF_v1 — a WYSIWYS break.
 *
 * SES envelopes pass through unchanged. The existing per-route guards still
 * enforce COMPLETED/REJECTED rejection for them.
 *
 * Call this **twice** at every TSP-eligible authoring route:
 *
 * 1. Outside the transaction with the pre-fetched envelope snapshot —
 *    `assertEnvelopeMutable(envelope)` — fast-fail without a DB round-trip.
 * 2. Inside the transaction with `tx` — `assertEnvelopeMutable(envelope, tx)`
 *    — re-fetches under the transaction's snapshot, closing the TOCTOU
 *    window against a concurrent `sendDocument` committing DRAFT → PENDING
 *    between the snapshot read and the mutation.
 *
 * Throws:
 * - `ENVELOPE_TSP_LOCKED` when the envelope is PENDING (the case unique to
 *   the TSP lock — SES routes happily allow PENDING).
 * - `ENVELOPE_COMPLETED` / `ENVELOPE_REJECTED` / `ENVELOPE_CANCELLED` for those
 *   terminal states, to stay consistent with the existing envelope-state error
 *   vocabulary.
 */
export function assertEnvelopeMutable(envelope: EnvelopeMutableSnapshot): Promise<void>;
export function assertEnvelopeMutable(envelope: EnvelopeIdRef, tx: Prisma.TransactionClient): Promise<void>;

export async function assertEnvelopeMutable(
  envelope: EnvelopeMutableSnapshot | EnvelopeIdRef,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (tx) {
    return await refetchAndAssert(tx, (envelope as EnvelopeIdRef).id);
  }

  assertSnapshotMutable(envelope as EnvelopeMutableSnapshot);
}

const refetchAndAssert = async (tx: Prisma.TransactionClient, envelopeId: string): Promise<void> => {
  const refetched = await tx.envelope.findFirstOrThrow({
    where: { id: envelopeId },
    select: { signatureLevel: true, status: true },
  });

  assertSnapshotMutable(refetched);
};

const assertSnapshotMutable = (envelope: EnvelopeMutableSnapshot): void => {
  if (!isTspEnvelope(envelope)) {
    return;
  }

  if (envelope.status === DocumentStatus.DRAFT) {
    return;
  }

  const errorCode = match(envelope.status)
    .with(DocumentStatus.PENDING, () => AppErrorCode.ENVELOPE_TSP_LOCKED)
    .with(DocumentStatus.COMPLETED, () => AppErrorCode.ENVELOPE_COMPLETED)
    .with(DocumentStatus.REJECTED, () => AppErrorCode.ENVELOPE_REJECTED)
    .with(DocumentStatus.CANCELLED, () => AppErrorCode.ENVELOPE_CANCELLED)
    .otherwise(() => AppErrorCode.INVALID_REQUEST);

  throw new AppError(errorCode, {
    message: `Envelope is locked — AES/QES envelopes cannot be modified after leaving DRAFT (current status: ${envelope.status}).`,
  });
};
