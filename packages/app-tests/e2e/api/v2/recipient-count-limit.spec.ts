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
import { type APIRequestContext, type APIResponse, expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../../assets/example.pdf'));

/**
 * Set the `recipientCount` limit on the organisation that owns the seeded team.
 *
 * A value of `0` means unlimited recipients are allowed.
 */
const setOrganisationRecipientCount = async (team: Team, recipientCount: number) => {
  const organisationClaim = await prisma.organisationClaim.findFirstOrThrow({
    where: {
      organisation: {
        id: team.organisationId,
      },
    },
  });

  await prisma.organisationClaim.update({
    where: {
      id: organisationClaim.id,
    },
    data: {
      recipientCount,
    },
  });
};

const createEnvelope = async (request: APIRequestContext, authToken: string) => {
  const payload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: 'Recipient Count Limit Test',
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  formData.append('files', new File([examplePdfBuffer], 'example.pdf', { type: 'application/pdf' }));

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
 * Build an envelope with exactly `recipientCount` SIGNER recipients, each with
 * their own signature field, then attempt to distribute it.
 *
 * Returns the raw distribute response so the caller can assert on the status.
 */
const buildAndDistributeEnvelopeWithRecipients = async ({
  request,
  authToken,
  recipientCount,
}: {
  request: APIRequestContext;
  authToken: string;
  recipientCount: number;
}): Promise<{ envelopeId: string; distributeRes: APIResponse }> => {
  const envelope = await createEnvelope(request, authToken);

  // Create N SIGNER recipients in a single request.
  const recipientData = Array.from({ length: recipientCount }).map((_, index) => ({
    email: `recipient-${index}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.documenso.com`,
    name: `Recipient ${index}`,
    role: RecipientRole.SIGNER,
    accessAuth: [],
    actionAuth: [],
  }));

  const recipientsRes = await request.post(`${baseUrl}/envelope/recipient/create-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId: envelope.id,
      data: recipientData,
    } satisfies TCreateEnvelopeRecipientsRequest,
  });

  expect(recipientsRes.ok()).toBeTruthy();

  const recipients = (await recipientsRes.json()).data;

  // Resolve the envelope item ID to place fields on.
  const envelopeData = await getEnvelope(request, authToken, envelope.id);
  const envelopeItemId = envelopeData.envelopeItems[0].id;

  // Each SIGNER must have a signature field, otherwise distribution fails for
  // a reason unrelated to the recipient count.
  const fieldData = recipients.map((recipient: { id: number }) => ({
    recipientId: recipient.id,
    envelopeItemId,
    type: FieldType.SIGNATURE,
    page: 1,
    positionX: 100,
    positionY: 100,
    width: 50,
    height: 50,
  }));

  const fieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId: envelope.id,
      data: fieldData,
    },
  });

  expect(fieldsRes.ok()).toBeTruthy();

  // Attempt to distribute the envelope.
  const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId: envelope.id,
    } satisfies TDistributeEnvelopeRequest,
  });

  return { envelopeId: envelope.id, distributeRes };
};

const expectEnvelopeStatus = async (envelopeId: string, status: DocumentStatus) => {
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
  });

  expect(envelope.status).toBe(status);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Recipient count limit on distribute', () => {
  let user: User;
  let team: Team;
  let token: string;

  test.beforeEach(async () => {
    ({ user, team } = await seedUser());
    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-recipient-count-limit',
      expiresIn: null,
    }));
  });

  // -----------------------------------------------------------------------
  // Limit = 3. Edge cases around the boundary: 2 (under), 3 (at), 4 (over).
  // -----------------------------------------------------------------------

  test('should allow distribution when recipient count is below the limit', async ({ request }) => {
    await setOrganisationRecipientCount(team, 3);

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithRecipients({
      request,
      authToken: token,
      recipientCount: 2,
    });

    expect(distributeRes.ok()).toBeTruthy();
    expect(distributeRes.status()).toBe(200);

    await expectEnvelopeStatus(envelopeId, DocumentStatus.PENDING);
  });

  test('should allow distribution when recipient count is exactly at the limit', async ({ request }) => {
    await setOrganisationRecipientCount(team, 3);

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithRecipients({
      request,
      authToken: token,
      recipientCount: 3,
    });

    expect(distributeRes.ok()).toBeTruthy();
    expect(distributeRes.status()).toBe(200);

    await expectEnvelopeStatus(envelopeId, DocumentStatus.PENDING);
  });

  test('should deny distribution when recipient count is one over the limit', async ({ request }) => {
    await setOrganisationRecipientCount(team, 3);

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithRecipients({
      request,
      authToken: token,
      recipientCount: 4,
    });

    expect(distributeRes.ok()).toBeFalsy();
    expect(distributeRes.status()).toBe(400);

    // The envelope must remain a DRAFT — distribution was rejected.
    await expectEnvelopeStatus(envelopeId, DocumentStatus.DRAFT);
  });

  // -----------------------------------------------------------------------
  // Limit = 1. The smallest non-unlimited boundary.
  // -----------------------------------------------------------------------

  test('should allow distribution with a single recipient when the limit is 1', async ({ request }) => {
    await setOrganisationRecipientCount(team, 1);

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithRecipients({
      request,
      authToken: token,
      recipientCount: 1,
    });

    expect(distributeRes.ok()).toBeTruthy();
    expect(distributeRes.status()).toBe(200);

    await expectEnvelopeStatus(envelopeId, DocumentStatus.PENDING);
  });

  test('should deny distribution with two recipients when the limit is 1', async ({ request }) => {
    await setOrganisationRecipientCount(team, 1);

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithRecipients({
      request,
      authToken: token,
      recipientCount: 2,
    });

    expect(distributeRes.ok()).toBeFalsy();
    expect(distributeRes.status()).toBe(400);

    await expectEnvelopeStatus(envelopeId, DocumentStatus.DRAFT);
  });

  // -----------------------------------------------------------------------
  // Limit = 0 means unlimited recipients are allowed.
  // -----------------------------------------------------------------------

  test('should allow distribution with many recipients when the limit is 0 (unlimited)', async ({ request }) => {
    await setOrganisationRecipientCount(team, 0);

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithRecipients({
      request,
      authToken: token,
      recipientCount: 10,
    });

    expect(distributeRes.ok()).toBeTruthy();
    expect(distributeRes.status()).toBe(200);

    await expectEnvelopeStatus(envelopeId, DocumentStatus.PENDING);
  });
});
