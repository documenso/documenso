import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, DocumentStatus, SendStatus, SigningStatus } from '@prisma/client';

import { apiSignin } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

const callDeleteRecipient = async (page: Page, input: { id: number; reason?: string }) => {
  return await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/admin.recipient.delete`, {
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({ json: { reason: 'Removed at the request of the sender', ...input } }),
  });
};

const findJobByDocumentId = async (jobId: string, documentId: number) => {
  return await prisma.backgroundJob.findFirst({
    where: {
      jobId,
      payload: { path: ['documentId'], equals: documentId },
    },
  });
};

const findRemovalEmailJob = async (envelopeId: string, recipientEmail: string) => {
  return await prisma.backgroundJob.findFirst({
    where: {
      jobId: 'send.admin.recipient.removed.emails',
      AND: [
        { payload: { path: ['envelopeId'], equals: envelopeId } },
        { payload: { path: ['recipientEmail'], equals: recipientEmail } },
      ],
    },
  });
};

// ─── Access control ──────────────────────────────────────────────────────────

test('[ADMIN][TRPC][DELETE_RECIPIENT]: unauthenticated request is rejected with 401', async ({ page }) => {
  const { user: owner, team } = await seedUser();
  const document = await seedPendingDocument(owner, team.id, ['recipient@test.documenso.com']);

  const recipient = document.recipients[0];

  const res = await callDeleteRecipient(page, { id: recipient.id });

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(401);

  const stillExists = await prisma.recipient.findUnique({ where: { id: recipient.id } });
  expect(stillExists).not.toBeNull();
});

test('[ADMIN][TRPC][DELETE_RECIPIENT]: non-admin authenticated user is rejected with 401', async ({ page }) => {
  const { user: nonAdminUser } = await seedUser({ isAdmin: false });
  const { user: owner, team } = await seedUser();
  const document = await seedPendingDocument(owner, team.id, ['recipient@test.documenso.com']);

  const recipient = document.recipients[0];

  await apiSignin({ page, email: nonAdminUser.email });

  const res = await callDeleteRecipient(page, { id: recipient.id });

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(401);

  const stillExists = await prisma.recipient.findUnique({ where: { id: recipient.id } });
  expect(stillExists).not.toBeNull();
});

// ─── Behaviour ───────────────────────────────────────────────────────────────

test('[ADMIN][TRPC][DELETE_RECIPIENT]: admin can remove a recipient who has opened the document and inserted fields', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, team } = await seedUser();

  const recipientEmail = 'recipient@test.documenso.com';

  // Seeded recipients are OPENED with an inserted field, which the non-admin flow refuses to delete.
  const document = await seedPendingDocument(owner, team.id, [recipientEmail, 'other@test.documenso.com']);

  const recipient = document.recipients.find((r) => r.email === recipientEmail);

  if (!recipient) {
    throw new Error('Recipient not seeded');
  }

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteRecipient(page, { id: recipient.id });

  expect(res.ok()).toBeTruthy();

  const deletedRecipient = await prisma.recipient.findUnique({ where: { id: recipient.id } });
  expect(deletedRecipient).toBeNull();

  const remainingFields = await prisma.field.count({ where: { recipientId: recipient.id } });
  expect(remainingFields).toBe(0);

  const remainingRecipients = await prisma.recipient.findMany({ where: { envelopeId: document.id } });
  expect(remainingRecipients).toHaveLength(1);
  expect(remainingRecipients[0].email).toBe('other@test.documenso.com');

  const auditLog = await prisma.documentAuditLog.findFirst({
    where: {
      envelopeId: document.id,
      type: 'RECIPIENT_DELETED',
    },
  });

  expect(auditLog).not.toBeNull();
  expect(auditLog?.userId).toBe(adminUser.id);
  expect(auditLog?.email).toBe(adminUser.email);
  expect(auditLog?.data).toMatchObject({
    recipientId: recipient.id,
    recipientEmail,
    removedByAdmin: true,
    reason: 'Removed at the request of the sender',
  });

  // Parallel signing with a signer still pending: nothing to seal or advance.
  expect(
    await findJobByDocumentId('internal.seal-document', mapSecondaryIdToDocumentId(document.secondaryId)),
  ).toBeNull();
  expect(
    await findJobByDocumentId('send.signing.requested.email', mapSecondaryIdToDocumentId(document.secondaryId)),
  ).toBeNull();

  const job = await findRemovalEmailJob(document.id, recipientEmail);

  expect(job).not.toBeNull();
  expect(job?.payload).toMatchObject({
    envelopeId: document.id,
    recipientEmail,
    notifyRecipient: true,
  });
});

test('[ADMIN][TRPC][DELETE_RECIPIENT]: admin cannot remove a recipient who has completed signing', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, team } = await seedUser();

  const recipientEmail = 'recipient@test.documenso.com';

  const document = await seedPendingDocument(owner, team.id, [recipientEmail, 'other@test.documenso.com']);

  const recipient = document.recipients.find((r) => r.email === recipientEmail);

  if (!recipient) {
    throw new Error('Recipient not seeded');
  }

  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { signingStatus: SigningStatus.SIGNED, signedAt: new Date() },
  });

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteRecipient(page, { id: recipient.id });

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(400);

  const stillExists = await prisma.recipient.findUnique({ where: { id: recipient.id } });
  expect(stillExists).not.toBeNull();

  const job = await findRemovalEmailJob(document.id, recipientEmail);
  expect(job).toBeNull();
});

test('[ADMIN][TRPC][DELETE_RECIPIENT]: admin cannot remove a recipient from a completed document', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, team } = await seedUser();

  const recipientEmail = 'recipient@test.documenso.com';

  const document = await seedPendingDocument(owner, team.id, [recipientEmail], {
    createDocumentOptions: {
      status: DocumentStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  const recipient = document.recipients[0];

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteRecipient(page, { id: recipient.id });

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(400);

  const stillExists = await prisma.recipient.findUnique({ where: { id: recipient.id } });
  expect(stillExists).not.toBeNull();
});

test('[ADMIN][TRPC][DELETE_RECIPIENT]: unknown recipient returns 404', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteRecipient(page, { id: 999_999_999 });

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(404);
});

test('[ADMIN][TRPC][DELETE_RECIPIENT]: a missing reason is rejected with 400', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, team } = await seedUser();
  const document = await seedPendingDocument(owner, team.id, ['recipient@test.documenso.com']);

  const recipient = document.recipients[0];

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteRecipient(page, { id: recipient.id, reason: '   ' });

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(400);

  const stillExists = await prisma.recipient.findUnique({ where: { id: recipient.id } });
  expect(stillExists).not.toBeNull();
});

test('[ADMIN][TRPC][DELETE_RECIPIENT]: document is sealed when every remaining signer has already signed', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, team } = await seedUser();

  const document = await seedPendingDocument(owner, team.id, [
    'signed@test.documenso.com',
    'blocking@test.documenso.com',
  ]);

  const signedRecipient = document.recipients.find((r) => r.email === 'signed@test.documenso.com');
  const blockingRecipient = document.recipients.find((r) => r.email === 'blocking@test.documenso.com');

  if (!signedRecipient || !blockingRecipient) {
    throw new Error('Recipients not seeded');
  }

  await prisma.recipient.update({
    where: { id: signedRecipient.id },
    data: { signingStatus: SigningStatus.SIGNED, signedAt: new Date() },
  });

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteRecipient(page, { id: blockingRecipient.id });

  expect(res.ok()).toBeTruthy();

  const sealJob = await findJobByDocumentId('internal.seal-document', mapSecondaryIdToDocumentId(document.secondaryId));
  expect(sealJob).not.toBeNull();

  await expect
    .poll(
      async () => {
        const envelope = await prisma.envelope.findUniqueOrThrow({ where: { id: document.id } });

        return envelope.status;
      },
      { timeout: 30_000 },
    )
    .toBe(DocumentStatus.COMPLETED);
});

test('[ADMIN][TRPC][DELETE_RECIPIENT]: document with no remaining signers is not sealed', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, team } = await seedUser();

  const document = await seedPendingDocument(owner, team.id, ['only@test.documenso.com']);

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteRecipient(page, { id: document.recipients[0].id });

  expect(res.ok()).toBeTruthy();

  expect(
    await findJobByDocumentId('internal.seal-document', mapSecondaryIdToDocumentId(document.secondaryId)),
  ).toBeNull();

  const envelope = await prisma.envelope.findUniqueOrThrow({ where: { id: document.id } });
  expect(envelope.status).toBe(DocumentStatus.PENDING);
});

test('[ADMIN][TRPC][DELETE_RECIPIENT]: sequential signing advances to the next recipient', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, team } = await seedUser();

  const document = await seedPendingDocument(owner, team.id, [
    'first@test.documenso.com',
    'second@test.documenso.com',
    'third@test.documenso.com',
  ]);

  await prisma.documentMeta.update({
    where: { id: document.documentMetaId },
    data: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
  });

  const [first, second, third] = ['first', 'second', 'third'].map((prefix) => {
    const recipient = document.recipients.find((r) => r.email === `${prefix}@test.documenso.com`);

    if (!recipient) {
      throw new Error(`Recipient ${prefix} not seeded`);
    }

    return recipient;
  });

  await prisma.recipient.update({
    where: { id: first.id },
    data: { signingOrder: 1, sendStatus: SendStatus.SENT },
  });

  await prisma.recipient.update({
    where: { id: second.id },
    data: { signingOrder: 2, sendStatus: SendStatus.NOT_SENT, sentAt: null },
  });

  await prisma.recipient.update({
    where: { id: third.id },
    data: { signingOrder: 3, sendStatus: SendStatus.NOT_SENT, sentAt: null },
  });

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteRecipient(page, { id: first.id });

  expect(res.ok()).toBeTruthy();

  const updatedSecond = await prisma.recipient.findUniqueOrThrow({ where: { id: second.id } });
  expect(updatedSecond.sendStatus).toBe(SendStatus.SENT);

  const updatedThird = await prisma.recipient.findUniqueOrThrow({ where: { id: third.id } });
  expect(updatedThird.sendStatus).toBe(SendStatus.NOT_SENT);

  const signingJob = await prisma.backgroundJob.findFirst({
    where: {
      jobId: 'send.signing.requested.email',
      AND: [
        { payload: { path: ['documentId'], equals: mapSecondaryIdToDocumentId(document.secondaryId) } },
        { payload: { path: ['recipientId'], equals: second.id } },
      ],
    },
  });

  expect(signingJob).not.toBeNull();

  const thirdSigningJob = await prisma.backgroundJob.findFirst({
    where: {
      jobId: 'send.signing.requested.email',
      AND: [
        { payload: { path: ['documentId'], equals: mapSecondaryIdToDocumentId(document.secondaryId) } },
        { payload: { path: ['recipientId'], equals: third.id } },
      ],
    },
  });

  expect(thirdSigningJob).toBeNull();

  expect(
    await findJobByDocumentId('internal.seal-document', mapSecondaryIdToDocumentId(document.secondaryId)),
  ).toBeNull();
});
