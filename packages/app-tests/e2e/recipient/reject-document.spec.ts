import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { rejectDocumentOnBehalfOf } from '@documenso/lib/server-only/document/reject-document-on-behalf-of';
import { rejectDocumentWithToken } from '@documenso/lib/server-only/document/reject-document-with-token';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentStatus, SigningStatus } from '@prisma/client';

/**
 * These drive the server functions directly rather than the browser or the
 * API, so two requests can be in flight at the same moment.
 */

test('[REJECT_DOCUMENT]: only one of two simultaneous rejections takes effect', async () => {
  const { document, recipients } = await seedDocumentWithTwoRecipients();

  const outcomes = await Promise.allSettled(
    recipients.map(async (recipient) =>
      rejectDocumentWithToken({
        token: recipient.token,
        id: { type: 'envelopeId', id: document.id },
        reason: 'I do not agree',
      }),
    ),
  );

  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { recipients: true },
  });

  expect(envelope.status).toBe(DocumentStatus.REJECTED);
  expect(envelope.recipients.filter((recipient) => recipient.signingStatus === SigningStatus.REJECTED)).toHaveLength(1);
});

test('[REJECT_DOCUMENT]: a completion does not overwrite a rejection that was in flight with it', async () => {
  const { document, recipients } = await seedDocumentWithTwoRecipients();

  const [recipient] = recipients;
  const id = { type: 'envelopeId', id: document.id } as const;

  const { first: rejection, second: completion } = await runBothBeforeEitherWrites(
    recipient.id,
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

for (const isRejectedThroughApi of [false, true]) {
  const rejectedBy = isRejectedThroughApi ? 'the API on their behalf' : 'the recipient';

  test(`[REJECT_DOCUMENT]: a rejection by ${rejectedBy} does not overwrite a completion that was in flight with it`, async () => {
    const { owner, team, document, recipients } = await seedDocumentWithTwoRecipients();

    const [recipient] = recipients;
    const id = { type: 'envelopeId', id: document.id } as const;
    const reason = 'I do not agree';

    const { first: completion, second: rejection } = await runBothBeforeEitherWrites(
      recipient.id,
      async () => completeDocumentWithToken({ token: recipient.token, id }),
      async () =>
        isRejectedThroughApi
          ? rejectDocumentOnBehalfOf({
              envelopeId: document.id,
              recipientId: recipient.id,
              userId: owner.id,
              teamId: team.id,
              reason,
              requestMetadata: { requestMetadata: {}, source: 'apiV2', auth: 'api' },
            })
          : rejectDocumentWithToken({ token: recipient.token, id, reason }),
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
}

const seedDocumentWithTwoRecipients = async () => {
  const { user: owner, team } = await seedUser();
  const { user: firstSigner } = await seedUser();
  const { user: secondSigner } = await seedUser();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [firstSigner, secondSigner],
    // No fields, so completion is not blocked by unsigned required fields.
    fields: [],
  });

  return { owner, team, document, recipients };
};

/**
 * Runs two requests for one recipient so that both have read the recipient
 * before either writes to it, which is what two requests arriving together do.
 * `first` is the one whose write lands first.
 *
 * The recipient row is locked while both are started. Reads pass the lock and
 * writes queue behind it in the order they arrive.
 */
const runBothBeforeEitherWrites = async (
  recipientId: number,
  first: () => Promise<unknown>,
  second: () => Promise<unknown>,
) => {
  const outcomes = await prisma.$transaction(
    async (tx) => {
      const [{ pid: lockHolderPid }] = await tx.$queryRaw<{ pid: number }[]>`
        SELECT pg_backend_pid() AS "pid" FROM "Recipient" WHERE "id" = ${recipientId} FOR UPDATE
      `;

      const firstOutcome = Promise.allSettled([first()]);
      const firstPid = await waitForSessionBlockedBy(lockHolderPid);

      const secondOutcome = Promise.allSettled([second()]);
      await waitForSessionBlockedBy(firstPid);

      return [firstOutcome, secondOutcome];
    },
    { timeout: 30_000 },
  );

  const [[firstResult], [secondResult]] = await Promise.all(outcomes);

  return { first: firstResult, second: secondResult };
};

const waitForSessionBlockedBy = async (blockingPid: number) => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const [blockedSession] = await prisma.$queryRaw<{ pid: number }[]>`
      SELECT "pid" FROM pg_stat_activity WHERE ${blockingPid}::int = ANY (pg_blocking_pids("pid"))
    `;

    if (blockedSession) {
      return blockedSession.pid;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`No session is waiting on session ${blockingPid}`);
};
