import { type APIRequestContext, expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, EnvelopeType, FieldType, RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TDistributeEnvelopeRequest } from '@documenso/trpc/server/envelope-router/distribute-envelope.types';
import type { TCreateEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';
import type { TUpdateEnvelopeItemsRequest } from '@documenso/trpc/server/envelope-router/update-envelope-items.types';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const createEnvelope = async (request: APIRequestContext, authToken: string) => {
  const payload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: 'Update Items Test',
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));

  const pdfData = fs.readFileSync(path.join(__dirname, '../../../../../assets/example.pdf'));
  formData.append('files', new File([pdfData], 'test.pdf', { type: 'application/pdf' }));

  const res = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${authToken}` },
    multipart: formData,
  });

  expect(res.ok()).toBeTruthy();

  return (await res.json()) as TCreateEnvelopeResponse;
};

const getEnvelope = async (request: APIRequestContext, authToken: string, envelopeId: string) => {
  const res = await request.get(`${baseUrl}/envelope/${envelopeId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  expect(res.ok()).toBeTruthy();

  return (await res.json()) as TGetEnvelopeResponse;
};

/**
 * Transition an envelope from DRAFT to PENDING by adding a recipient with a
 * signature field and distributing.
 */
const distributeEnvelope = async (
  request: APIRequestContext,
  authToken: string,
  envelopeId: string,
) => {
  const recipientEmail = `signer-${Date.now()}@test.documenso.com`;

  // Create a SIGNER recipient.
  const recipientsRes = await request.post(`${baseUrl}/envelope/recipient/create-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId,
      data: [
        {
          email: recipientEmail,
          name: 'Test Signer',
          role: RecipientRole.SIGNER,
          accessAuth: [],
          actionAuth: [],
        },
      ],
    } satisfies TCreateEnvelopeRecipientsRequest,
  });

  expect(recipientsRes.ok()).toBeTruthy();

  const recipients = (await recipientsRes.json()).data;

  // Resolve the envelope item ID.
  const envelope = await getEnvelope(request, authToken, envelopeId);
  const envelopeItemId = envelope.envelopeItems[0].id;

  // Create a SIGNATURE field.
  const fieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId,
      data: [
        {
          recipientId: recipients[0].id,
          envelopeItemId,
          type: FieldType.SIGNATURE,
          page: 1,
          positionX: 100,
          positionY: 100,
          width: 50,
          height: 50,
        },
      ],
    },
  });

  expect(fieldsRes.ok()).toBeTruthy();

  // Distribute.
  const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId,
    } satisfies TDistributeEnvelopeRequest,
  });

  expect(distributeRes.ok()).toBeTruthy();
};

const updateEnvelopeItems = async (
  request: APIRequestContext,
  authToken: string,
  payload: TUpdateEnvelopeItemsRequest,
) => {
  return request.post(`${baseUrl}/envelope/item/update-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: payload,
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Update envelope items', () => {
  let user: User;
  let team: Team;
  let token: string;

  test.beforeEach(async () => {
    ({ user, team } = await seedUser());
    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-update-items',
      expiresIn: null,
    }));
  });

  // -----------------------------------------------------------------------
  // DRAFT envelope — full edit allowed
  // -----------------------------------------------------------------------

  test('should allow updating item title on a DRAFT envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, title: 'New Draft Title' }],
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const dbItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: { id: envelopeItem.id },
    });

    expect(dbItem.title).toBe('New Draft Title');
  });

  test('should allow updating item order on a DRAFT envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, order: 5 }],
    });

    expect(res.ok()).toBeTruthy();

    const dbItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: { id: envelopeItem.id },
    });

    expect(dbItem.order).toBe(5);
  });

  // -----------------------------------------------------------------------
  // PENDING envelope — title-only edit allowed
  // -----------------------------------------------------------------------

  test('should allow updating item title on a PENDING envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, title: 'Updated Pending Title' }],
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const dbItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: { id: envelopeItem.id },
    });

    expect(dbItem.title).toBe('Updated Pending Title');
  });

  test('should allow title-only update when order matches existing on a PENDING envelope', async ({
    request,
  }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    // Send the same order value that already exists — this should be treated as title-only.
    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [
        {
          envelopeItemId: envelopeItem.id,
          title: 'Title With Same Order',
          order: envelopeItem.order,
        },
      ],
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const dbItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: { id: envelopeItem.id },
    });

    expect(dbItem.title).toBe('Title With Same Order');
  });

  test('should create an ENVELOPE_ITEM_UPDATED audit log when updating item title on PENDING envelope', async ({
    request,
  }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];
    const originalTitle = envelopeItem.title;

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, title: 'Audited Title' }],
    });

    expect(res.ok()).toBeTruthy();

    const auditLog = await prisma.documentAuditLog.findFirst({
      where: {
        envelopeId: envelope.id,
        type: 'ENVELOPE_ITEM_UPDATED',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditLog).not.toBeNull();

    const auditData = auditLog!.data as Record<string, unknown>;

    expect(auditData.envelopeItemId).toBe(envelopeItem.id);

    const changes = auditData.changes as Array<{ field: string; from: string; to: string }>;

    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('title');
    expect(changes[0].from).toBe(originalTitle);
    expect(changes[0].to).toBe('Audited Title');
  });

  // -----------------------------------------------------------------------
  // PENDING envelope — order change blocked
  // -----------------------------------------------------------------------

  test('should reject order change on a PENDING envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, order: 99 }],
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);
  });

  test('should reject combined title and order change on a PENDING envelope', async ({
    request,
  }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [
        {
          envelopeItemId: envelopeItem.id,
          title: 'Should Not Save',
          order: 99,
        },
      ],
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);

    // Verify title was NOT changed.
    const dbItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: { id: envelopeItem.id },
    });

    expect(dbItem.title).not.toBe('Should Not Save');
  });

  // -----------------------------------------------------------------------
  // COMPLETED envelope — all edits blocked
  // -----------------------------------------------------------------------

  test('should reject title update on a COMPLETED envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    // Transition to COMPLETED directly via database.
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { status: DocumentStatus.COMPLETED, completedAt: new Date() },
    });

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, title: 'Should Not Save' }],
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);

    // Verify title was NOT changed.
    const dbItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: { id: envelopeItem.id },
    });

    expect(dbItem.title).not.toBe('Should Not Save');
  });

  test('should reject order update on a COMPLETED envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { status: DocumentStatus.COMPLETED, completedAt: new Date() },
    });

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, order: 99 }],
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);
  });

  // -----------------------------------------------------------------------
  // REJECTED envelope — all edits blocked
  // -----------------------------------------------------------------------

  test('should reject title update on a REJECTED envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    // Transition to REJECTED directly via database.
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { status: DocumentStatus.REJECTED },
    });

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, title: 'Should Not Save' }],
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);

    // Verify title was NOT changed.
    const dbItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: { id: envelopeItem.id },
    });

    expect(dbItem.title).not.toBe('Should Not Save');
  });

  test('should reject order update on a REJECTED envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { status: DocumentStatus.REJECTED },
    });

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, order: 99 }],
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);
  });

  // -----------------------------------------------------------------------
  // Deleted envelope — all edits blocked
  // -----------------------------------------------------------------------

  test('should reject title update on a deleted envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    await distributeEnvelope(request, token, envelope.id);

    // Soft-delete the envelope.
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { deletedAt: new Date() },
    });

    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, title: 'Should Not Save' }],
    });

    expect(res.ok()).toBeFalsy();
  });

  // -----------------------------------------------------------------------
  // Validation edge cases
  // -----------------------------------------------------------------------

  test('should reject an empty title on any envelope', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);
    const envelopeItem = envelopeData.envelopeItems[0];

    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelope.id,
      data: [{ envelopeItemId: envelopeItem.id, title: '' }],
    });

    expect(res.ok()).toBeFalsy();
  });

  test('should reject update for an envelope item that does not belong to the envelope', async ({
    request,
  }) => {
    const envelopeA = await createEnvelope(request, token);
    const envelopeB = await createEnvelope(request, token);

    const envelopeBData = await getEnvelope(request, token, envelopeB.id);
    const envelopeBItem = envelopeBData.envelopeItems[0];

    // Try to update envelopeB's item via envelopeA's ID.
    const res = await updateEnvelopeItems(request, token, {
      envelopeId: envelopeA.id,
      data: [{ envelopeItemId: envelopeBItem.id, title: 'Cross Envelope' }],
    });

    expect(res.ok()).toBeFalsy();
  });
});
