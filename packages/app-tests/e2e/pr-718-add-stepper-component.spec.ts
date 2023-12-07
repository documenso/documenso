import { expect, test } from '@playwright/test';
import path from 'node:path';

import { TEST_USER } from '@documenso/prisma/seed/pr-718-add-stepper-component';

test(`[PR-718]: should be able to create a document`, async ({ page }) => {
  await page.goto('/signin');

  const documentTitle = `example-${Date.now()}.pdf`;

  // Sign in
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Upload document
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('input[type=file]').evaluate((e) => {
      if (e instanceof HTMLInputElement) {
        e.click();
      }
    }),
  ]);

  await fileChooser.setFiles(path.join(__dirname, '../../../assets/example.pdf'));

  // Wait to be redirected to the edit page
  await page.waitForURL(/\/documents\/\d+/);

  // Set title
  await expect(page.getByRole('heading', { name: 'Add Title' })).toBeVisible();

  await page.getByLabel('Title').fill(documentTitle);

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add signers
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  await page.getByLabel('Email*').fill('user1@example.com');
  await page.getByLabel('Name').fill('User 1');

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add fields
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'User 1 Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Email Email' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 200,
    },
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  // Add subject and send
  await expect(page.getByRole('heading', { name: 'Add Subject' })).toBeVisible();
  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL('/documents');

  // Assert document was created
  await expect(page.getByRole('link', { name: documentTitle })).toBeVisible();
});
