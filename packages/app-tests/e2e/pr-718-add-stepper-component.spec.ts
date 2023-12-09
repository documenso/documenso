import { expect } from '@playwright/test';

import { test } from '../fixtures';

const documentTitle = `example-${Date.now()}.pdf`;

test.beforeEach(async ({ users }) => {
  const user = await users.create();
  await user.apiLogin();
});

test.afterEach(async ({ users }) => {
  await users.deleteAll();
});

test(`[PR-718]: should be able to create a document`, async ({ page, documents, samplePdf }) => {
  await page.goto('/documents');

  await documents.upload(samplePdf);

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
