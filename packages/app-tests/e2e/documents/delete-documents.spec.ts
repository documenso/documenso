import { expect, test } from '@playwright/test';

import {
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';

test.describe.configure({ mode: 'serial' });

const seedDeleteDocumentsTestRequirements = async () => {
  const [sender, recipientA, recipientB] = await Promise.all([seedUser(), seedUser(), seedUser()]);

  const [draftDocument, pendingDocument, completedDocument] = await Promise.all([
    seedDraftDocument(sender, [recipientA, recipientB], {
      createDocumentOptions: { title: 'Document 1 - Draft' },
    }),
    seedPendingDocument(sender, [recipientA, recipientB], {
      createDocumentOptions: { title: 'Document 1 - Pending' },
    }),
    seedCompletedDocument(sender, [recipientA, recipientB], {
      createDocumentOptions: { title: 'Document 1 - Completed' },
    }),
  ]);

  return {
    sender,
    recipients: [recipientA, recipientB],
    draftDocument,
    pendingDocument,
    completedDocument,
  };
};

test('[DOCUMENTS]: seeded documents should be visible', async ({ page }) => {
  const { sender, recipients } = await seedDeleteDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.email,
  });

  await expect(page.getByRole('link', { name: 'Document 1 - Completed' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Document 1 - Draft' })).toBeVisible();

  await apiSignout({ page });

  for (const recipient of recipients) {
    await apiSignin({
      page,
      email: recipient.email,
    });

    await expect(page.getByRole('link', { name: 'Document 1 - Completed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Document 1 - Draft' })).not.toBeVisible();

    await apiSignout({ page });
  }
});

test('[DOCUMENTS]: deleting a completed document should not remove it from recipients', async ({
  page,
}) => {
  const { sender, recipients } = await seedDeleteDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.email,
  });

  // open actions menu
  await page
    .locator('tr', { hasText: 'Document 1 - Completed' })
    .getByRole('cell', { name: 'Download' })
    .getByRole('button')
    .nth(1)
    .click();

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: /Document 1 - Completed/ })).not.toBeVisible();

  await apiSignout({ page });

  for (const recipient of recipients) {
    await apiSignin({
      page,
      email: recipient.email,
    });

    await expect(page.getByRole('link', { name: 'Document 1 - Completed' })).toBeVisible();
    await page.getByRole('link', { name: 'Document 1 - Completed' }).click();
    await expect(page.getByText('Everyone has signed').nth(0)).toBeVisible();

    await apiSignout({ page });
  }
});

test('[DOCUMENTS]: deleting a pending document should remove it from recipients', async ({
  page,
}) => {
  const { sender, pendingDocument } = await seedDeleteDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.email,
  });

  // open actions menu
  await page.locator('tr', { hasText: 'Document 1 - Pending' }).getByRole('button').nth(1).click();

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: /Document 1 - Pending/ })).not.toBeVisible();

  // signout
  await apiSignout({ page });

  for (const recipient of pendingDocument.Recipient) {
    await apiSignin({
      page,
      email: recipient.email,
    });

    await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).not.toBeVisible();

    await page.goto(`/sign/${recipient.token}`);
    await expect(page.getByText(/document.*cancelled/i).nth(0)).toBeVisible();

    await page.goto('/documents');
    await page.waitForURL('/documents');

    await apiSignout({ page });
  }
});

test('[DOCUMENTS]: deleting a draft document should remove it without additional prompting', async ({
  page,
}) => {
  const { sender } = await seedDeleteDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.email,
  });

  // open actions menu
  await page
    .locator('tr', { hasText: 'Document 1 - Draft' })
    .getByRole('cell', { name: 'Edit' })
    .getByRole('button')
    .click();

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByPlaceholder("Type 'delete' to confirm")).not.toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: /Document 1 - Draft/ })).not.toBeVisible();
});
