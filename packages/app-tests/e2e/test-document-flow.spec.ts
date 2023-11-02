import { expect } from '@playwright/test';

import { test } from '../fixtures/fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

const testSigners = [
  { email: 'signer1@gmail.com', name: 'signer 1' },
  { email: 'signer2@gmail.com', name: 'signer 2' },
  { email: 'signer3@gmail.com', name: 'signer 3' },
];

test.describe('test document flow', async () => {
  test.beforeEach(async ({ users }) => {
    const user = await users.create();
    await user.apiLogin();
  });
  test.afterEach(async ({ users }) => users.deleteAll());

  test('user can upload documents', async ({ page, samplePdf }) => {
    await page.goto('/documents');
    await expect(page).toHaveURL('/documents');

    await page.getByTestId('document-dropzone').setInputFiles({
      buffer: samplePdf,
      mimeType: 'application/pdf',
      name: 'test.pdf',
    });

    await expect(page).toHaveURL(/\/documents\/\d+/);
  });

  test('user can add signers', async ({ page, samplePdf }) => {
    await page.goto('/documents');
    await expect(page).toHaveURL('/documents');

    await page.getByTestId('document-dropzone').setInputFiles({
      buffer: samplePdf,
      mimeType: 'application/pdf',
      name: 'test.pdf',
    });

    await expect(page).toHaveURL(/\/documents\/\d+/);

    expect(await page.getByTestId('signer-delete-0').isDisabled()).toBe(true);

    await page.locator('input[name="signers.0.name"]').fill(testSigners[0].name);
    await page.locator('input[name="signers.0.email"]').fill(testSigners[0].email);
    await page.getByTestId('signer-add').click();

    await page.locator('input[name="signers.1.name"]').fill(testSigners[1].name);
    await page.locator('input[name="signers.1.email"]').fill(testSigners[1].email);
    await page.getByTestId('signer-add').click();

    await page.locator('input[name="signers.2.name"]').fill(testSigners[2].name);
    await page.locator('input[name="signers.2.email"]').fill(testSigners[2].email);

    await page.getByTestId('signer-delete-2').click();

    await page.getByTestId('document-flow-next').click();

    await page.getByTestId('signature-button').click();
    await page.locator('canvas').click({
      position: {
        x: 489,
        y: 607,
      },
    });

    await page.getByTestId('document-flow-next').click();

    await page.getByLabel('Subject (Optional)').fill('test subject');
    await page.getByLabel('Message (Optional)').fill('test message');

    await page.getByTestId('document-flow-next').click();

    await expect(page).toHaveURL('/documents');
  });
});
