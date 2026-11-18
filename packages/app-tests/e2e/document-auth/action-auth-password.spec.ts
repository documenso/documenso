import { createDocumentAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { waitForHydration } from '../fixtures/hydration';
import { signSignaturePad } from '../fixtures/signature';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const SEEDED_PASSWORD = 'password';
const NEW_PASSWORD = 'Test123!';

/**
 * Seed a document requiring PASSWORD action auth for a recipient with an account,
 * and sign the recipient in on the signing page.
 *
 * Action auth is gated behind the cfr21 claim flag at write time only, so seeding
 * the auth options directly bypasses the gate the same way action-auth.spec.ts does.
 */
const seedPasswordActionAuthDocument = async () => {
  const { user: owner, team } = await seedUser();
  const { user: recipient } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [recipient],
    updateDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: [],
        globalActionAuth: ['PASSWORD'],
      }),
    },
    fields: [FieldType.SIGNATURE],
  });

  const { token, fields } = recipients[0];

  const signatureField = fields.find((field) => field.type === FieldType.SIGNATURE);

  if (!signatureField) {
    throw new Error('Expected a signature field to be seeded');
  }

  return {
    recipient,
    signUrl: `/sign/${token}`,
    signatureField,
  };
};

test('[DOCUMENT_AUTH]: passwordless user is sent a setup link and can sign after setting a password', async ({
  page,
}) => {
  const { recipient, signUrl, signatureField } = await seedPasswordActionAuthDocument();

  await apiSignin({
    page,
    email: recipient.email,
    password: SEEDED_PASSWORD,
    redirectPath: signUrl,
  });

  // Simulate an OAuth / passkey only account by removing the password after sign in.
  await prisma.user.update({
    where: { id: recipient.id },
    data: { password: null },
  });

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  await page.locator(`#field-${signatureField.id}`).getByRole('button').click();

  await expect(page.getByText('Reauthentication is required to sign this field')).toBeVisible();
  await expect(page.getByText('No password set')).toBeVisible();

  // A bare session must not be able to set a password inline; it gets emailed a link instead.
  await expect(page.getByLabel('New password')).not.toBeVisible();

  await page.getByRole('button', { name: 'Send setup link' }).click();
  await expect(page.getByText('Check your email')).toBeVisible();

  const resetToken = await prisma.passwordResetToken.findFirstOrThrow({
    where: { userId: recipient.id },
  });

  // Complete the emailed flow, which also invalidates all sessions.
  await page.goto(`/reset-password/${resetToken.token}`);

  // Filling controlled inputs before hydration gets reset by React.
  await waitForHydration(page, 'input[name="password"]');

  await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Repeat Password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(page.locator('body')).toContainText('Your password has been updated successfully.');

  // Come back with the new password and the normal reauth form should now work.
  await apiSignin({
    page,
    email: recipient.email,
    password: NEW_PASSWORD,
    redirectPath: signUrl,
  });

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  await page.locator(`#field-${signatureField.id}`).getByRole('button').click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByText('No password set')).not.toBeVisible();

  await dialog.getByLabel('Password').fill(NEW_PASSWORD);
  await dialog.getByRole('button', { name: 'Sign' }).click();

  await expect(page.locator(`#field-${signatureField.id}`)).toHaveAttribute('data-inserted', 'true');
});

test('[DOCUMENT_AUTH]: user with a password sees the normal password reauth form', async ({ page }) => {
  const { recipient, signUrl, signatureField } = await seedPasswordActionAuthDocument();

  await apiSignin({
    page,
    email: recipient.email,
    password: SEEDED_PASSWORD,
    redirectPath: signUrl,
  });

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  await page.locator(`#field-${signatureField.id}`).getByRole('button').click();

  await expect(page.getByText('Reauthentication is required to sign this field')).toBeVisible();
  await expect(page.getByText('No password set')).not.toBeVisible();

  const dialog = page.getByRole('dialog');

  // Wrong password is rejected.
  await dialog.getByLabel('Password').fill('wrong-password');
  await dialog.getByRole('button', { name: 'Sign' }).click();
  await expect(dialog.getByText('Unauthorized')).toBeVisible();

  // Correct password signs the field.
  await dialog.getByLabel('Password').fill(SEEDED_PASSWORD);
  await dialog.getByRole('button', { name: 'Sign' }).click();

  await expect(page.locator(`#field-${signatureField.id}`)).toHaveAttribute('data-inserted', 'true');
});

test('[DOCUMENT_AUTH]: passwordless user can request a setup link from security settings', async ({ page }) => {
  const { user } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    password: SEEDED_PASSWORD,
    redirectPath: '/settings/profile',
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { password: null },
  });

  await page.goto('/settings/security');

  await expect(page.getByRole('heading', { name: 'Set a password' })).toBeVisible();
  await expect(page.getByLabel('Current password')).not.toBeVisible();
  await expect(page.getByLabel('New password')).not.toBeVisible();

  // Clicking before hydration is a no-op, so retry until the sent state appears.
  await expect(async () => {
    await page.getByRole('button', { name: 'Send setup link' }).click();
    await expect(page.getByRole('button', { name: 'Link sent' })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id },
  });

  expect(resetToken).not.toBeNull();
});
