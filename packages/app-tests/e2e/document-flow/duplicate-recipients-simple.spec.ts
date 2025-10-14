import { expect, test } from '@playwright/test';

import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[DOCUMENT_FLOW]: Simple duplicate recipients test', async ({ page }) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  // Step 1: Settings - Continue with defaults
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // Step 2: Add duplicate recipients
  await page.getByPlaceholder('Email').fill('duplicate@example.com');
  await page.getByPlaceholder('Name').fill('Duplicate 1');

  await page.getByRole('button', { name: 'Add Signer' }).click();
  await page.getByLabel('Email').nth(1).fill('duplicate@example.com');
  await page.getByLabel('Name').nth(1).fill('Duplicate 2');

  // Continue to fields
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  // Step 3: Add fields
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({ position: { x: 100, y: 100 } });

  await page.getByRole('combobox').first().click();

  // Switch to second duplicate and add field
  await page.getByText('Duplicate 2 (duplicate@example.com)').first().click();
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({ position: { x: 200, y: 100 } });

  // Continue to send
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();

  // Send document
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  await expect(page.getByRole('link', { name: document.title })).toBeVisible();
});
