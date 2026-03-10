import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, RecipientRole } from '@documenso/prisma/client';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TDistributeEnvelopeRequest } from '@documenso/trpc/server/envelope-router/distribute-envelope.types';

import { apiSignin } from '../fixtures/authentication';
import { openDropdownMenu } from '../fixtures/generic';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

const examplePdf = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

test.describe.configure({ mode: 'parallel' });

test('[ENVELOPE_EXPIRATION]: sending document sets expiresAt on recipients', async ({
  request,
}) => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test-expiration-send',
    expiresIn: null,
  });

  const createPayload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: '[TEST] Expiration Send Test',
    recipients: [
      {
        email: 'signer-expiry@test.documenso.com',
        name: 'Signer Expiry',
        role: RecipientRole.SIGNER,
        fields: [
          {
            type: 'SIGNATURE',
            page: 1,
            positionX: 10,
            positionY: 10,
            width: 10,
            height: 5,
            fieldMeta: { type: 'signature' },
          },
        ],
      },
    ],
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(createPayload));
  formData.append('files', new File([examplePdf], 'example.pdf', { type: 'application/pdf' }));

  const createRes = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });

  expect(createRes.ok()).toBeTruthy();

  const { id: envelopeId }: TCreateEnvelopeResponse = await createRes.json();

  const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { envelopeId } satisfies TDistributeEnvelopeRequest,
  });

  expect(distributeRes.ok()).toBeTruthy();

  // Check that recipients now have expiresAt set.
  const recipients = await prisma.recipient.findMany({
    where: { envelopeId },
  });

  expect(recipients.length).toBe(1);
  expect(recipients[0].expiresAt).not.toBeNull();

  // The default expiration period is 3 months. Verify it's roughly correct.
  const expiresAt = recipients[0].expiresAt!;
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // 3 months is roughly 89-92 days. Allow a generous range.
  expect(diffDays).toBeGreaterThan(80);
  expect(diffDays).toBeLessThan(100);
});

test('[ENVELOPE_EXPIRATION]: sending document with custom org expiration period', async ({
  request,
}) => {
  const { user, organisation, team } = await seedUser();

  // Set org expiration to 7 days.
  await prisma.organisationGlobalSettings.update({
    where: { id: organisation.organisationGlobalSettingsId },
    data: { envelopeExpirationPeriod: { unit: 'day', amount: 7 } },
  });

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test-expiration-custom',
    expiresIn: null,
  });

  const createPayload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: '[TEST] Custom Expiration Send Test',
    recipients: [
      {
        email: 'signer-custom@test.documenso.com',
        name: 'Signer Custom',
        role: RecipientRole.SIGNER,
        fields: [
          {
            type: 'SIGNATURE',
            page: 1,
            positionX: 10,
            positionY: 10,
            width: 10,
            height: 5,
            fieldMeta: { type: 'signature' },
          },
        ],
      },
    ],
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(createPayload));
  formData.append('files', new File([examplePdf], 'example.pdf', { type: 'application/pdf' }));

  const createRes = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });

  expect(createRes.ok()).toBeTruthy();

  const { id: envelopeId }: TCreateEnvelopeResponse = await createRes.json();

  const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { envelopeId } satisfies TDistributeEnvelopeRequest,
  });

  expect(distributeRes.ok()).toBeTruthy();

  const recipients = await prisma.recipient.findMany({
    where: { envelopeId },
  });

  expect(recipients.length).toBe(1);
  expect(recipients[0].expiresAt).not.toBeNull();

  // 7 days expiration.
  const expiresAt = recipients[0].expiresAt!;
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  expect(diffDays).toBeGreaterThan(6);
  expect(diffDays).toBeLessThan(8);
});

test('[ENVELOPE_EXPIRATION]: sending document with expiration disabled', async ({ request }) => {
  const { user, organisation, team } = await seedUser();

  // Disable expiration at org level.
  await prisma.organisationGlobalSettings.update({
    where: { id: organisation.organisationGlobalSettingsId },
    data: { envelopeExpirationPeriod: { disabled: true } },
  });

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test-expiration-disabled',
    expiresIn: null,
  });

  const createPayload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: '[TEST] Disabled Expiration Send Test',
    recipients: [
      {
        email: 'signer-disabled@test.documenso.com',
        name: 'Signer Disabled',
        role: RecipientRole.SIGNER,
        fields: [
          {
            type: 'SIGNATURE',
            page: 1,
            positionX: 10,
            positionY: 10,
            width: 10,
            height: 5,
            fieldMeta: { type: 'signature' },
          },
        ],
      },
    ],
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(createPayload));
  formData.append('files', new File([examplePdf], 'example.pdf', { type: 'application/pdf' }));

  const createRes = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });

  expect(createRes.ok()).toBeTruthy();

  const { id: envelopeId }: TCreateEnvelopeResponse = await createRes.json();

  const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { envelopeId } satisfies TDistributeEnvelopeRequest,
  });

  expect(distributeRes.ok()).toBeTruthy();

  const recipients = await prisma.recipient.findMany({
    where: { envelopeId },
  });

  expect(recipients.length).toBe(1);
  expect(recipients[0].expiresAt).toBeNull();
});

test('[ENVELOPE_EXPIRATION]: resending refreshes expiresAt', async ({ page }) => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['resend-target@test.documenso.com']);

  const recipient = document.recipients[0];

  // Set an initial expiresAt that's 1 day from now.
  const initialExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { expiresAt: initialExpiresAt },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents?status=PENDING`,
  });

  // Open the document action menu and click Resend.
  const actionBtn = page.getByTestId('document-table-action-btn').first();
  await expect(actionBtn).toBeAttached();
  await openDropdownMenu(page, actionBtn);
  await expect(page.getByRole('menuitem', { name: 'Resend' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Resend' }).click();

  // Select the recipient and send.
  await page.getByLabel('test.documenso.com').first().click();
  await page.getByRole('button', { name: 'Send reminder' }).click();

  await expect(page.getByText('Document re-sent', { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  // Verify expiresAt was refreshed.
  await expect(async () => {
    const updatedRecipient = await prisma.recipient.findUniqueOrThrow({
      where: { id: recipient.id },
    });

    expect(updatedRecipient.expiresAt).not.toBeNull();
    expect(updatedRecipient.expiresAt!.getTime()).toBeGreaterThan(initialExpiresAt.getTime());
  }).toPass({ timeout: 10_000 });
});
