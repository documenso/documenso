import { type APIRequestContext, expect, test } from '@playwright/test';
import type { Team, User } from '@documenso/prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { EnvelopeType, FieldType, RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TCreateEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

test.describe('Envelope distribute validation', () => {
  let user: User, team: Team, token: string;

  test.beforeEach(async () => {
    ({ user, team } = await seedUser());
    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    }));
  });

  const createEnvelope = async (request: APIRequestContext, authToken: string) => {
    const payload: TCreateEnvelopePayload = {
      type: EnvelopeType.DOCUMENT,
      title: 'Test Document',
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

  const createRecipients = async (
    request: APIRequestContext,
    authToken: string,
    envelopeId: string,
    recipients: TCreateEnvelopeRecipientsRequest['data'],
  ) => {
    const res = await request.post(`${baseUrl}/envelope/recipient/create-many`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        envelopeId,
        data: recipients,
      } satisfies TCreateEnvelopeRecipientsRequest,
    });

    expect(res.ok()).toBeTruthy();
    return (await res.json()).data;
  };

  const createFields = async (
    request: APIRequestContext,
    authToken: string,
    envelopeId: string,
    envelopeItemId: string,
    fields: Array<{ recipientId: number; type: FieldType }>,
  ) => {
    const res = await request.post(`${baseUrl}/envelope/field/create-many`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        envelopeId,
        data: fields.map((field, index) => ({
          recipientId: field.recipientId,
          envelopeItemId,
          type: field.type,
          page: 1,
          positionX: 10,
          positionY: 10 + index * 10,
          width: 10,
          height: 10,
        })),
      },
    });

    expect(res.ok()).toBeTruthy();
    return (await res.json()).data;
  };

  test('should fail to distribute when signer has no fields', async ({ request }) => {
    const envelope = await createEnvelope(request, token);

    // Create a signer without any fields
    await createRecipients(request, token, envelope.id, [
      {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
    ]);

    // Try to distribute without adding any fields
    const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { envelopeId: envelope.id },
    });

    expect(distributeRes.ok()).toBeFalsy();
    expect(distributeRes.status()).toBe(400);

    const errorResponse = await distributeRes.json();
    expect(errorResponse.message).toContain('missing required fields');
    expect(errorResponse.message).toContain('Signers must have at least one signature field');
  });

  test('should fail to distribute when signer has non-signature fields only', async ({
    request,
  }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);

    // Create a signer
    const recipients = await createRecipients(request, token, envelope.id, [
      {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
    ]);

    // Add only a TEXT field (not a signature field)
    await createFields(request, token, envelope.id, envelopeData.envelopeItems[0].id, [
      { recipientId: recipients[0].id, type: FieldType.TEXT },
    ]);

    // Try to distribute
    const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { envelopeId: envelope.id },
    });

    expect(distributeRes.ok()).toBeFalsy();
    expect(distributeRes.status()).toBe(400);

    const errorResponse = await distributeRes.json();
    expect(errorResponse.message).toContain('missing required fields');
  });

  test('should succeed when signer has SIGNATURE field', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);

    // Create a signer
    const recipients = await createRecipients(request, token, envelope.id, [
      {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
    ]);

    // Add a SIGNATURE field
    await createFields(request, token, envelope.id, envelopeData.envelopeItems[0].id, [
      { recipientId: recipients[0].id, type: FieldType.SIGNATURE },
    ]);

    // Distribute should succeed
    const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { envelopeId: envelope.id },
    });

    expect(distributeRes.ok()).toBeTruthy();
    expect(distributeRes.status()).toBe(200);

    const response = await distributeRes.json();
    expect(response.success).toBe(true);
  });

  // Note: FREE_SIGNATURE field type is not supported via the v2 API for field creation,
  // so we only test with SIGNATURE fields here. The v1 tests cover FREE_SIGNATURE
  // using direct Prisma creation.

  test('should succeed when VIEWER has no fields', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);

    // Create a signer and a viewer
    const recipients = await createRecipients(request, token, envelope.id, [
      {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
      {
        email: 'viewer@example.com',
        name: 'Test Viewer',
        role: RecipientRole.VIEWER,
        accessAuth: [],
        actionAuth: [],
      },
    ]);

    // Add signature field only for the signer (viewer has no fields)
    await createFields(request, token, envelope.id, envelopeData.envelopeItems[0].id, [
      { recipientId: recipients[0].id, type: FieldType.SIGNATURE },
    ]);

    // Distribute should succeed
    const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { envelopeId: envelope.id },
    });

    expect(distributeRes.ok()).toBeTruthy();
    expect(distributeRes.status()).toBe(200);
  });

  test('should succeed when CC has no fields', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);

    // Create a signer and a CC recipient
    const recipients = await createRecipients(request, token, envelope.id, [
      {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
      {
        email: 'cc@example.com',
        name: 'Test CC',
        role: RecipientRole.CC,
        accessAuth: [],
        actionAuth: [],
      },
    ]);

    // Add signature field only for the signer (CC has no fields)
    await createFields(request, token, envelope.id, envelopeData.envelopeItems[0].id, [
      { recipientId: recipients[0].id, type: FieldType.SIGNATURE },
    ]);

    // Distribute should succeed
    const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { envelopeId: envelope.id },
    });

    expect(distributeRes.ok()).toBeTruthy();
    expect(distributeRes.status()).toBe(200);
  });

  test('should succeed when APPROVER has no fields', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);

    // Create a signer and an approver
    const recipients = await createRecipients(request, token, envelope.id, [
      {
        email: 'signer@example.com',
        name: 'Test Signer',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
      {
        email: 'approver@example.com',
        name: 'Test Approver',
        role: RecipientRole.APPROVER,
        accessAuth: [],
        actionAuth: [],
      },
    ]);

    // Add signature field only for the signer (approver has no fields)
    await createFields(request, token, envelope.id, envelopeData.envelopeItems[0].id, [
      { recipientId: recipients[0].id, type: FieldType.SIGNATURE },
    ]);

    // Distribute should succeed
    const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { envelopeId: envelope.id },
    });

    expect(distributeRes.ok()).toBeTruthy();
    expect(distributeRes.status()).toBe(200);
  });

  test('should fail when one of multiple signers is missing signature field', async ({
    request,
  }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);

    // Create two signers
    const recipients = await createRecipients(request, token, envelope.id, [
      {
        email: 'signer1@example.com',
        name: 'Test Signer 1',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
      {
        email: 'signer2@example.com',
        name: 'Test Signer 2',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
    ]);

    // Add signature field only for the first signer
    await createFields(request, token, envelope.id, envelopeData.envelopeItems[0].id, [
      { recipientId: recipients[0].id, type: FieldType.SIGNATURE },
    ]);

    // Distribute should fail because second signer has no signature field
    const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { envelopeId: envelope.id },
    });

    expect(distributeRes.ok()).toBeFalsy();
    expect(distributeRes.status()).toBe(400);

    const errorResponse = await distributeRes.json();
    expect(errorResponse.message).toContain('missing required fields');
  });

  test('should succeed when all signers have signature fields', async ({ request }) => {
    const envelope = await createEnvelope(request, token);
    const envelopeData = await getEnvelope(request, token, envelope.id);

    // Create two signers
    const recipients = await createRecipients(request, token, envelope.id, [
      {
        email: 'signer1@example.com',
        name: 'Test Signer 1',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
      {
        email: 'signer2@example.com',
        name: 'Test Signer 2',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
    ]);

    // Add signature fields for both signers
    await createFields(request, token, envelope.id, envelopeData.envelopeItems[0].id, [
      { recipientId: recipients[0].id, type: FieldType.SIGNATURE },
      { recipientId: recipients[1].id, type: FieldType.SIGNATURE },
    ]);

    // Distribute should succeed
    const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { envelopeId: envelope.id },
    });

    expect(distributeRes.ok()).toBeTruthy();
    expect(distributeRes.status()).toBe(200);
  });
});
