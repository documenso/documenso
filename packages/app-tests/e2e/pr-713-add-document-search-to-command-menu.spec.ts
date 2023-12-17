import { expect } from '@playwright/test';

import { test } from '../fixtures';

const sentDocumentName = `[713] Document - Sent ${Date.now()}`;
const receivedDocumentName = `[713] Document - Received ${Date.now()}`;

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

  await user1.apiLogin();
});

test.afterEach(async ({ users, documents }) => {
  await users.deleteAll();

  await documents.deleteAll();
});

test('[PR-713]: test document search', async ({ page, users }) => {
  await page.goto('/documents');

  await page.keyboard.press('Meta+K');

  const searchInput = await page.getByPlaceholder('Type a command or search...');

  await test.step('should see sent documents', async () => {
    await searchInput.fill('sent');
    await expect(page.getByRole('option', { name: sentDocumentName })).toBeVisible();
  });

  await test.step('should see received documents', async () => {
    await searchInput.fill('received');
    await expect(page.getByRole('option', { name: receivedDocumentName })).toBeVisible();
  });

  await test.step('should be able to search by recipient', async () => {
    const [_sender, recipient] = users.get();
    await searchInput.fill(recipient.email);
    await expect(page.getByRole('option', { name: '[713] Document - Sent' })).toBeVisible();
  });

  await test.step('should close the dialog', async () => {
    await page.keyboard.press('Escape');
    await expect(searchInput).not.toBeVisible();
  });
});
