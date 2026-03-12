import { expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';
import { FieldType } from '@documenso/prisma/client';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

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
