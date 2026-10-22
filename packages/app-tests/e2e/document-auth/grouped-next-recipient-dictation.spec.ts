import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, SendStatus } from '@prisma/client';

/**
 * Dictation lets a signer rewrite who signs next. It cannot be allowed to
 * operate on a signing group, for two reasons the server enforces separately:
 *
 *   1. The next step must hold exactly one recipient (`nextGroup.length === 1`),
 *      otherwise there is no single "next signer" to rewrite.
 *   2. A signer whose own step is still pending (a peer has not signed) does not
 *      advance the flow at all, so they never reach the dictation branch.
 *
 * Both are silent — passing `nextSigner` into a state that disallows dictation
 * is ignored rather than rejected — which is exactly why they need asserting.
 * The existing dictation specs all drive the UI and none use a grouped step.
 */

const DICTATED_SIGNER = {
  name: 'Dictated Signer',
  email: 'dictated-signer@example.com',
};

const expectRecipientUpdatedAuditLogCount = async (envelopeId: string, expected: number) => {
  const auditLogs = await prisma.documentAuditLog.findMany({
    where: {
      envelopeId,
      type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED,
    },
  });

  expect(auditLogs.length).toBe(expected);
};

const seedDictationDocument = async (signingOrders: number[]) => {
  const { user, team } = await seedUser();

  const signers = await Promise.all(signingOrders.map(async () => (await seedUser()).user));

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: signers,
    recipientsCreateOptions: signingOrders.map((signingOrder) => ({
      signingOrder,
      // The seed defaults every recipient to SENT; later steps of a real
      // SEQUENTIAL document are NOT_SENT until their step unlocks.
      sendStatus: signingOrder === 1 ? SendStatus.SENT : SendStatus.NOT_SENT,
    })),
    // No fields, so completion is not blocked by unsigned required fields.
    fields: [],
    updateDocumentOptions: {
      documentMeta: {
        upsert: {
          create: {
            signingOrder: DocumentSigningOrder.SEQUENTIAL,
            allowDictateNextSigner: true,
          },
          update: {
            signingOrder: DocumentSigningOrder.SEQUENTIAL,
            allowDictateNextSigner: true,
          },
        },
      },
    },
  });

  return signers.map((signer) => {
    const recipient = recipients.find((item) => item.email === signer.email);

    if (!recipient) {
      throw new Error(`Seeded recipient ${signer.email} not found`);
    }

    return recipient;
  });
};

test('[NEXT_RECIPIENT_DICTATION]: dictation is ignored when the next step is a group', async () => {
  // Steps: 1 = first, 2 = two grouped recipients.
  const [first, groupA, groupB] = await seedDictationDocument([1, 2, 2]);

  await completeDocumentWithToken({
    token: first.token,
    id: { type: 'envelopeId', id: first.envelopeId },
    nextSigner: DICTATED_SIGNER,
  });

  const groupAAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: groupA.id } });
  const groupBAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: groupB.id } });

  // Neither member of the group may be rewritten.
  expect(groupAAfter.email).toBe(groupA.email);
  expect(groupAAfter.name).toBe(groupA.name);
  expect(groupBAfter.email).toBe(groupB.email);
  expect(groupBAfter.name).toBe(groupB.name);

  // The dictated identity must not have leaked onto anyone.
  const dictated = await prisma.recipient.findFirst({
    where: { envelopeId: first.envelopeId, email: DICTATED_SIGNER.email },
  });

  expect(dictated).toBeNull();

  // A rewrite that did not happen must not be recorded as having happened.
  await expectRecipientUpdatedAuditLogCount(first.envelopeId, 0);

  // The group is still activated as normal — only the rewrite is suppressed.
  expect(groupAAfter.sendStatus).toBe(SendStatus.SENT);
  expect(groupBAfter.sendStatus).toBe(SendStatus.SENT);
});

test('[NEXT_RECIPIENT_DICTATION]: a group member cannot dictate while a peer is still unsigned', async () => {
  // Steps: 1 = two grouped recipients, 2 = last.
  const [groupA, groupB, last] = await seedDictationDocument([1, 1, 2]);

  // The first member of the group signs while their peer is still outstanding.
  await completeDocumentWithToken({
    token: groupA.token,
    id: { type: 'envelopeId', id: groupA.envelopeId },
    nextSigner: DICTATED_SIGNER,
  });

  const lastWhilePeerPending = await prisma.recipient.findUniqueOrThrow({
    where: { id: last.id },
  });

  // The step never unlocked, so there was nothing to dictate.
  expect(lastWhilePeerPending.email).toBe(last.email);
  expect(lastWhilePeerPending.name).toBe(last.name);
  expect(lastWhilePeerPending.sendStatus).toBe(SendStatus.NOT_SENT);
  await expectRecipientUpdatedAuditLogCount(groupA.envelopeId, 0);

  // The peer completing the group *does* advance to a single-recipient step,
  // so dictation applies — the positive control for the assertions above.
  await completeDocumentWithToken({
    token: groupB.token,
    id: { type: 'envelopeId', id: groupB.envelopeId },
    nextSigner: DICTATED_SIGNER,
  });

  const lastAfterGroupComplete = await prisma.recipient.findUniqueOrThrow({
    where: { id: last.id },
  });

  expect(lastAfterGroupComplete.email).toBe(DICTATED_SIGNER.email);
  expect(lastAfterGroupComplete.name).toBe(DICTATED_SIGNER.name);
  expect(lastAfterGroupComplete.sendStatus).toBe(SendStatus.SENT);
  await expectRecipientUpdatedAuditLogCount(groupA.envelopeId, 1);
});
