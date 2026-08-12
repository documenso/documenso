import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { FieldType } from '@documenso/prisma/client';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { type APIRequestContext, expect, test } from '@playwright/test';

import { apiSeedPendingDocument } from '../fixtures/api-seeds';
import { apiSignin } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

test.describe.configure({ mode: 'parallel' });

test('[ENVELOPE_EXPIRATION]: expired recipient is redirected to expired page', async ({ page }) => {
  const { user, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['expired-recipient@test.documenso.com'],
    teamId: team.id,
  });

  const recipient = recipients[0];

  // Set expiresAt to the past so the recipient is expired.
  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  await page.goto(`/sign/${recipient.token}`);
  await page.waitForURL(`/sign/${recipient.token}/expired`);

  await expect(page.getByText('Signing Deadline Expired')).toBeVisible();
  await expect(page.getByText('The signing deadline for this document has passed')).toBeVisible();
});

test('[ENVELOPE_EXPIRATION]: non-expired recipient can access signing page', async ({ page }) => {
  const { user, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['active-recipient@test.documenso.com'],
    teamId: team.id,
  });

  const recipient = recipients[0];

  // Set expiresAt to 1 hour in the future.
  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  await page.goto(`/sign/${recipient.token}`);

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
});

test('[ENVELOPE_EXPIRATION]: recipient with null expiresAt can sign normally', async ({ page }) => {
  const { user, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['null-expiry@test.documenso.com'],
    teamId: team.id,
  });

  const recipient = recipients[0];

  // Verify expiresAt is null (default from seed).
  const dbRecipient = await prisma.recipient.findUniqueOrThrow({
    where: { id: recipient.id },
  });

  expect(dbRecipient.expiresAt).toBeNull();

  await page.goto(`/sign/${recipient.token}`);

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
});

test('[ENVELOPE_EXPIRATION]: expired recipient cannot complete signing', async ({ page }) => {
  const { user, team } = await seedUser();

  // Use only a SIGNATURE field to simplify the signing flow.
  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: [user],
    teamId: team.id,
    fields: [FieldType.SIGNATURE],
  });

  const recipient = recipients[0];

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/sign/${recipient.token}`,
  });

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  // Now expire the recipient while they're on the signing page.
  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });

  // Set up signature.
  await signSignaturePad(page);

  // Click the signature field to attempt to insert it.
  // The server will reject because the recipient is now expired.
  const signatureField = recipient.fields.find((f) => f.type === FieldType.SIGNATURE);

  if (signatureField) {
    await page.locator(`#field-${signatureField.id}`).getByRole('button').click();
  }

  // The server should reject the signing attempt because the recipient has expired.
  // Verify the field was NOT inserted (stays data-inserted="false").
  if (signatureField) {
    await expect(async () => {
      const field = await prisma.field.findUniqueOrThrow({
        where: { id: signatureField.id },
      });

      expect(field.inserted).toBe(false);
    }).toPass({ timeout: 10_000 });
  }
});

const trpcMutation = async (request: APIRequestContext, procedure: string, input: Record<string, unknown>) => {
  return await request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/trpc/${procedure}`, {
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({ json: input }),
  });
};

/**
 * The signing page loader only redirects expired recipients, which a direct API call
 * bypasses. The tests above exercise the V1 signing path; this covers the V2 route
 * (`envelope.field.sign`), which must reject on the server regardless of the UI.
 */
test('[ENVELOPE_EXPIRATION]: expired recipient cannot sign a field via the V2 API', async ({ request }) => {
  const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
    title: '[TEST] Expired recipient V2 signing',
    recipients: [
      {
        email: `expired-v2-${Date.now()}@test.documenso.com`,
        name: 'Expired Signer',
        role: 'SIGNER',
        signingOrder: 1,
      },
    ],
    fieldsPerRecipient: [
      [
        { type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 5, width: 5, height: 5 },
        { type: FieldType.TEXT, page: 1, positionX: 5, positionY: 15, width: 5, height: 5 },
      ],
    ],
  });

  const recipient = distributeResult.recipients[0];

  const seededEnvelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelope.id },
    include: { fields: true },
  });

  const textField = seededEnvelope.fields.find((field) => field.type === FieldType.TEXT);

  if (!textField) {
    throw new Error('TEXT field not found on the seeded envelope');
  }

  // Sanity check: the recipient can sign while the signing window is open.
  const beforeExpiry = await trpcMutation(request, 'envelope.field.sign', {
    token: recipient.token,
    fieldId: textField.id,
    fieldValue: { type: FieldType.TEXT, value: 'before' },
  });

  expect(beforeExpiry.ok()).toBeTruthy();

  await prisma.field.update({
    where: { id: textField.id },
    data: { inserted: false, customText: '' },
  });

  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  const afterExpiry = await trpcMutation(request, 'envelope.field.sign', {
    token: recipient.token,
    fieldId: textField.id,
    fieldValue: { type: FieldType.TEXT, value: 'after' },
  });

  expect(afterExpiry.ok()).toBeFalsy();

  const fieldAfter = await prisma.field.findUniqueOrThrow({
    where: { id: textField.id },
  });

  expect(fieldAfter.inserted).toBe(false);
  expect(fieldAfter.customText).toBe('');
});
