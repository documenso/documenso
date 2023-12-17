import { expect } from '@playwright/test';

import { test } from '../fixtures';

const sentDocumentName = '[713] Document - Sent';
const receivedDocumentName = '[713] Document - Received';

let recipientEmail = '';

test.beforeEach(async ({ users, documents, samplePdf }) => {
  const user1 = await users.create();
  const user2 = await users.create();

  await documents.createPendingDocument({
    document: samplePdf.pdf,
    recipients: [{ email: user2.email, name: user2.name, id: user2.id }],
    title: sentDocumentName,
    userId: user1.id,
  });

  await documents.createPendingDocument({
    document: samplePdf.pdf,
    recipients: [{ email: user1.email, name: user1.name, id: user1.id }],
    title: receivedDocumentName,
    userId: user2.id,
  });

  recipientEmail = user2.email;
  await user1.apiLogin();
});

test.afterEach(async ({ users, documents }) => {
  await users.deleteAll();

  await documents.deleteAll();
});

test('[PR-713]: should see sent documents', async ({ page }) => {
  await page.goto('/documents');

  await page.keyboard.press('Meta+K');

  await page.getByPlaceholder('Type a command or search...').fill('sent');
  await expect(page.getByRole('option', { name: sentDocumentName })).toBeVisible();

  await page.keyboard.press('Escape');
});

test('[PR-713]: should see received documents', async ({ page }) => {
  await page.goto('/documents');

  await page.keyboard.press('Meta+K');

  await page.getByPlaceholder('Type a command or search...').fill('received');
  await expect(page.getByRole('option', { name: receivedDocumentName })).toBeVisible();

  await page.keyboard.press('Escape');
});

test('[PR-713]: should be able to search by recipient', async ({ page }) => {
  await page.goto('/documents');

  await page.keyboard.press('Meta+K');

  await page.getByPlaceholder('Type a command or search...').fill(recipientEmail);
  await expect(page.getByRole('option', { name: '[713] Document - Sent' })).toBeVisible();

  await page.keyboard.press('Escape');
});
