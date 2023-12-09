import { expect } from '@playwright/test';

import { test } from '../fixtures';

const completedDocumentTitle = 'Document 1 - Completed';
const draftDocumentTitle = 'Document 1 - Draft';
const pendingDocumentTitle = 'Document 1 - Pending';

test.beforeEach(async ({ users, documents, samplePdf }) => {
  const user = await users.create();

  const recipient1 = await users.create();
  const recipient2 = await users.create();

  const recipients = [
    { email: recipient1.email, name: recipient1.name },
    { email: recipient2.email, name: recipient2.name },
  ];

  await documents.createCompletedDocument({
    document: samplePdf.pdf,
    recipients,
    title: completedDocumentTitle,
    userId: user.id,
  });

  await documents.createDraftDocument({
    document: samplePdf.pdf,
    recipients,
    title: draftDocumentTitle,
    userId: user.id,
  });

  await documents.createPendingDocument({
    document: samplePdf.pdf,
    recipients,
    title: pendingDocumentTitle,
    userId: user.id,
  });

  await user.apiLogin();
});

test.afterEach(async ({ users, documents }) => {
  await users.deleteAll();
  await documents.deleteAll();
});

test('[PR-711]: seeded documents should be visible', async ({ page, users }) => {
  const [_sender, ...recipients] = users.get();

  await page.goto('/documents');

  await expect(page.getByRole('link', { name: completedDocumentTitle })).toBeVisible();
  await expect(page.getByRole('link', { name: pendingDocumentTitle })).toBeVisible();
  await expect(page.getByRole('link', { name: draftDocumentTitle })).toBeVisible();

  await users.logout();

  for (const recipient of recipients) {
    await recipient.apiLogin();

    await page.goto('/documents');

    await expect(page.getByRole('link', { name: completedDocumentTitle })).toBeVisible();
    await expect(page.getByRole('link', { name: pendingDocumentTitle })).toBeVisible();

    await expect(page.getByRole('link', { name: draftDocumentTitle })).not.toBeVisible();

    await users.logout();
  }
});

test('[PR-711]: deleting a completed document should not remove it from recipients', async ({
  page,
  users,
}) => {
  const [_sender, ...recipients] = users.get();

  await page.goto('/documents');

  // open actions menu
  await page
    .locator('tr', { hasText: completedDocumentTitle })
    .getByRole('cell', { name: 'Download' })
    .getByRole('button')
    .nth(1)
    .click();

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: completedDocumentTitle })).not.toBeVisible();

  // signout
  await users.logout();

  for (const recipient of recipients) {
    // sign in
    await recipient.apiLogin();

    await page.goto('/documents');

    await expect(page.getByRole('link', { name: completedDocumentTitle })).toBeVisible();

    await page.goto(`/sign/completed-token-${recipients.indexOf(recipient)}`);
    await expect(page.getByText('Everyone has signed').nth(0)).toBeVisible();

    await users.logout();
  }
});

test('[PR-711]: deleting a pending document should remove it from recipients', async ({
  page,
  users,
}) => {
  const [sender, ...recipients] = users.get();

  await users.logout();

  for (const recipient of recipients) {
    await page.goto(`/sign/pending-token-${recipients.indexOf(recipient)}/complete`);

    await expect(page.getByText('Waiting for others to sign').nth(0)).toBeVisible();
  }

  // sign in
  await sender.apiLogin();
  await page.goto('/documents');

  // open actions menu
  await page.locator('tr', { hasText: pendingDocumentTitle }).getByRole('button').nth(1).click();

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: pendingDocumentTitle })).not.toBeVisible();

  // signout
  await users.logout();

  for (const recipient of recipients) {
    // sign in
    await recipient.apiLogin();

    await page.goto('/documents');

    await expect(page.getByRole('link', { name: pendingDocumentTitle })).not.toBeVisible();

    await page.goto(`/sign/pending-token-${recipients.indexOf(recipient)}/complete`);
    await expect(page.getByText(/document.*cancelled/i).nth(0)).toBeVisible();

    await users.logout();
  }
});

test('[PR-711]: deleting a draft document should remove it without additional prompting', async ({
  page,
}) => {
  await page.goto('/documents');

  // open actions menu
  await page
    .locator('tr', { hasText: draftDocumentTitle })
    .getByRole('cell', { name: 'Edit' })
    .getByRole('button')
    .click();

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByPlaceholder("Type 'delete' to confirm")).not.toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: draftDocumentTitle })).not.toBeVisible();
});
