import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { adminFindUnsealedDocuments } from '@documenso/lib/server-only/admin/admin-find-unsealed-documents';
import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { rejectDocumentWithToken } from '@documenso/lib/server-only/document/reject-document-with-token';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType, Prisma, SigningStatus } from '@prisma/client';

/**
 * These drive the server functions directly rather than the browser or the
 * API, so that a row lock can decide the order in which two requests write.
 */

test('[REJECT_DOCUMENT]: only one of two rejections that were in flight together takes effect', async () => {
  const { document, recipients } = await seedDocumentWithTwoRecipients();

  const [firstRecipient, secondRecipient] = recipients;
  const id = { type: 'envelopeId', id: document.id } as const;
  const reason = 'I do not agree';

  // The first rejection takes the envelope and stops at its recipient, so the
  // second one queues behind it for the envelope.
  const { first, second } = await runBothBeforeEitherWrites(
    { table: 'Recipient', id: firstRecipient.id },
    async () => rejectDocumentWithToken({ token: firstRecipient.token, id, reason }),
    async () => rejectDocumentWithToken({ token: secondRecipient.token, id, reason }),
  );

  expect(first.status).toBe('fulfilled');
  expect(second).toMatchObject({ status: 'rejected', reason: { code: AppErrorCode.INVALID_REQUEST } });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { recipients: true },
  });

  const rejectedRecipientIds = envelope.recipients
    .filter((recipient) => recipient.signingStatus === SigningStatus.REJECTED)
    .map((recipient) => recipient.id);

  expect(envelope.status).toBe(DocumentStatus.REJECTED);
  expect(rejectedRecipientIds).toEqual([firstRecipient.id]);
});

test('[REJECT_DOCUMENT]: a completion does not overwrite a rejection that was in flight with it', async () => {
  const { document, recipients } = await seedDocumentWithTwoRecipients();

  const [recipient] = recipients;
  const id = { type: 'envelopeId', id: document.id } as const;

  const { first: rejection, second: completion } = await runBothBeforeEitherWrites(
    { table: 'Recipient', id: recipient.id },
    async () => rejectDocumentWithToken({ token: recipient.token, id, reason: 'I do not agree' }),
    async () => completeDocumentWithToken({ token: recipient.token, id }),
  );

  expect(rejection.status).toBe('fulfilled');
  expect(completion).toMatchObject({ status: 'rejected', reason: { code: AppErrorCode.ENVELOPE_REJECTED } });

  const { signingStatus, envelope } = await prisma.recipient.findUniqueOrThrow({
    where: { id: recipient.id },
    include: { envelope: true },
  });

  expect(signingStatus).toBe(SigningStatus.REJECTED);
  expect(envelope.status).toBe(DocumentStatus.REJECTED);
});

test('[REJECT_DOCUMENT]: a rejection does not overwrite a completion that was in flight with it', async () => {
  const { document, recipients } = await seedDocumentWithTwoRecipients();

  const [recipient] = recipients;
  const id = { type: 'envelopeId', id: document.id } as const;

  const { first: completion, second: rejection } = await runBothBeforeEitherWrites(
    { table: 'Recipient', id: recipient.id },
    async () => completeDocumentWithToken({ token: recipient.token, id }),
    async () => rejectDocumentWithToken({ token: recipient.token, id, reason: 'I do not agree' }),
  );

  expect(completion.status).toBe('fulfilled');
  expect(rejection).toMatchObject({ status: 'rejected', reason: { code: AppErrorCode.INVALID_REQUEST } });

  const { signingStatus, envelope } = await prisma.recipient.findUniqueOrThrow({
    where: { id: recipient.id },
    include: { envelope: true },
  });

  // The other recipient has not signed, so a PENDING envelope shows that the
  // rejection left nothing behind.
  expect(signingStatus).toBe(SigningStatus.SIGNED);
  expect(envelope.status).toBe(DocumentStatus.PENDING);
});

test('[REJECT_DOCUMENT]: a completion that read the envelope before a rejection is refused after it', async () => {
  const { document, recipients } = await seedDocumentWithTwoRecipients();

  const [rejecter, bystander] = recipients;
  const id = { type: 'envelopeId', id: document.id } as const;

  // The bystander's completion has read a PENDING envelope and stops at its
  // write. The other recipient's rejection then runs to the end.
  const { outcome } = await withRowLocked({ table: 'Recipient', id: bystander.id }, async (lockHolderPid) => {
    const completion = await startUntilBlockedBy(
      async () => completeDocumentWithToken({ token: bystander.token, id }),
      lockHolderPid,
    );

    await rejectDocumentWithToken({ token: rejecter.token, id, reason: 'I do not agree' });

    // Handed back unawaited, inside an object: see `runBothBeforeEitherWrites`.
    return { outcome: completion.outcome };
  });

  expect(await outcome).toMatchObject({ status: 'rejected', reason: { code: AppErrorCode.ENVELOPE_REJECTED } });

  const { signingStatus } = await prisma.recipient.findUniqueOrThrow({
    where: { id: bystander.id },
  });

  expect(signingStatus).toBe(SigningStatus.NOT_SIGNED);
});

test('[REJECT_DOCUMENT]: a duplicate completion is still reported as already signed', async () => {
  const { document, recipients } = await seedDocumentWithTwoRecipients();

  const [recipient] = recipients;
  const id = { type: 'envelopeId', id: document.id } as const;

  const { first, second } = await runBothBeforeEitherWrites(
    { table: 'Recipient', id: recipient.id },
    async () => completeDocumentWithToken({ token: recipient.token, id }),
    async () => completeDocumentWithToken({ token: recipient.token, id }),
  );

  expect(first.status).toBe('fulfilled');
  expect(second).toMatchObject({ status: 'rejected', reason: { code: AppErrorCode.RECIPIENT_ALREADY_SIGNED } });

  const completionCount = await prisma.documentAuditLog.count({
    where: {
      envelopeId: document.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED,
    },
  });

  expect(completionCount).toBe(1);
});

test('[REJECT_DOCUMENT]: sending again while a recipient rejects is refused and leaves the envelope rejected', async () => {
  const { owner, team, document, recipients } = await seedDocumentWithTwoRecipients({
    // Sending requires every signer to have a signature field.
    fields: [FieldType.SIGNATURE],
  });

  const [recipient] = recipients;
  const id = { type: 'envelopeId', id: document.id } as const;

  // The rejection queues for the envelope first, and the send behind it.
  const { first: rejection, second: resend } = await runBothBeforeEitherWrites(
    { table: 'Envelope', id: document.id },
    async () => rejectDocumentWithToken({ token: recipient.token, id, reason: 'I do not agree' }),
    async () =>
      sendDocument({
        id,
        userId: owner.id,
        teamId: team.id,
        requestMetadata: { requestMetadata: {}, source: 'app', auth: 'session' },
      }),
  );

  expect(rejection.status).toBe('fulfilled');
  expect(resend).toMatchObject({ status: 'rejected', reason: { message: 'Can not send completed document' } });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
  });

  expect(envelope.status).toBe(DocumentStatus.REJECTED);
});

test('[REJECT_DOCUMENT]: a rejected envelope is found and sealed as rejected when no recipient is marked as rejected', async () => {
  const { document } = await seedDocumentWithTwoRecipients();

  // What is left when the recipient who rejected is edited or removed afterwards.
  await prisma.envelope.update({
    where: { id: document.id },
    data: { status: DocumentStatus.REJECTED },
  });

  const findUnsealedEnvelopeIds = async () => {
    const { data } = await adminFindUnsealedDocuments({ perPage: 100 });

    return data.map((envelope) => envelope.id);
  };

  expect(await findUnsealedEnvelopeIds()).toContain(document.id);

  await jobs.triggerJob({
    name: 'internal.seal-document',
    payload: { documentId: mapSecondaryIdToDocumentId(document.secondaryId) },
  });

  await expect
    .poll(async () => prisma.envelope.findUniqueOrThrow({ where: { id: document.id } }), { timeout: 30_000 })
    .toMatchObject({ status: DocumentStatus.REJECTED, completedAt: expect.any(Date) });

  expect(await findUnsealedEnvelopeIds()).not.toContain(document.id);
});

// No fields by default, so completion is not blocked by unsigned required fields.
const seedDocumentWithTwoRecipients = async ({ fields = [] }: { fields?: FieldType[] } = {}) => {
  const { user: owner, team } = await seedUser();
  const { user: firstSigner } = await seedUser();
  const { user: secondSigner } = await seedUser();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [firstSigner, secondSigner],
    fields,
  });

  return { owner, team, document, recipients };
};

type LockedRow = { table: 'Envelope'; id: string } | { table: 'Recipient'; id: number };

type StartedRequest = {
  /** The database session that the request is waiting in. */
  pid: number;
  outcome: Promise<PromiseSettledResult<unknown>>;
};

const POLL_INTERVAL_MS = 25;

// A request reaches its first write well within this, and it stays under the
// 10s Prisma allows the transaction that the request then waits in.
const MAX_WAIT_UNTIL_BLOCKED_MS = 8_000;

// Room for two requests to become blocked, one after the other.
const ROW_LOCK_TIMEOUT_MS = 30_000;

/**
 * Runs two requests so that both have read the row before either writes to it,
 * which is what two requests arriving together do. `first` is the one whose
 * write lands first.
 */
const runBothBeforeEitherWrites = async (
  lockedRow: LockedRow,
  first: () => Promise<unknown>,
  second: () => Promise<unknown>,
) => {
  const outcomes = await withRowLocked(lockedRow, async (lockHolderPid) => {
    const firstRequest = await startUntilBlockedBy(first, lockHolderPid);
    const secondRequest = await startUntilBlockedBy(second, firstRequest.pid);

    // Handed back unawaited, inside an array: neither request can end before
    // the lock is released, so awaiting them here would wait for the timeout.
    return [firstRequest.outcome, secondRequest.outcome];
  });

  const [firstOutcome, secondOutcome] = await Promise.all(outcomes);

  return { first: firstOutcome, second: secondOutcome };
};

/**
 * Holds a lock on one row while `scenario` runs. Reads pass the lock. A request
 * that writes to the row stops at that write, with its decisions already made
 * from what it read, and writes queue behind the lock in the order they arrive.
 */
const withRowLocked = async <T>({ table, id }: LockedRow, scenario: (lockHolderPid: number) => Promise<T>) => {
  return await prisma.$transaction(
    async (tx) => {
      // NO KEY UPDATE is the lock an update of the row takes, so it stops writes
      // to the row itself but not inserts that only reference it, such as audit logs.
      const [{ pid: lockHolderPid }] = await tx.$queryRaw<{ pid: number }[]>(
        Prisma.sql`SELECT pg_backend_pid() AS "pid" FROM ${Prisma.raw(`"${table}"`)} WHERE "id" = ${id} FOR NO KEY UPDATE`,
      );

      return await scenario(lockHolderPid);
    },
    { timeout: ROW_LOCK_TIMEOUT_MS },
  );
};

/**
 * Starts a request and returns once it is waiting on a lock that the session
 * `blockingPid` holds or is itself queued for.
 */
const startUntilBlockedBy = async (request: () => Promise<unknown>, blockingPid: number): Promise<StartedRequest> => {
  const settled: PromiseSettledResult<unknown>[] = [];

  const outcome = Promise.allSettled([request()]).then(([result]) => {
    settled.push(result);

    return result;
  });

  const deadline = Date.now() + MAX_WAIT_UNTIL_BLOCKED_MS;

  while (Date.now() < deadline) {
    const [blockedSession] = await prisma.$queryRaw<{ pid: number }[]>`
      SELECT "pid" FROM pg_stat_activity WHERE ${blockingPid}::int = ANY (pg_blocking_pids("pid"))
    `;

    if (blockedSession) {
      return { pid: blockedSession.pid, outcome };
    }

    const [result] = settled;

    if (result) {
      const ending = result.status === 'rejected' ? `failed with ${String(result.reason)}` : 'succeeded';

      throw new Error(`The request ${ending} before it reached the locked row`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`No session is waiting on session ${blockingPid}`);
};
