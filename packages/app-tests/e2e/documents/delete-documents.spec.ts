import { expect, test } from '@playwright/test';

import {
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import { checkDocumentTabCount } from '../fixtures/documents';

test.describe.configure({ mode: 'serial' });

const seedDeleteDocumentsTestRequirements = async () => {
  const [sender, recipientA, recipientB] = await Promise.all([
    seedUser({ setTeamEmailAsOwner: true }),
    seedUser({ setTeamEmailAsOwner: true }),
    seedUser({ setTeamEmailAsOwner: true }),
  ]);

  const [draftDocument, pendingDocument, completedDocument] = await Promise.all([
    seedDraftDocument(sender.user, sender.team.id, [recipientA.user, recipientB.user], {
      createDocumentOptions: { title: 'Document 1 - Draft' },
    }),
    seedPendingDocument(sender.user, sender.team.id, [recipientA.user, recipientB.user], {
      createDocumentOptions: { title: 'Document 1 - Pending' },
    }),
    seedCompletedDocument(sender.user, sender.team.id, [recipientA.user, recipientB.user], {
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
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await expect(page.getByRole('link', { name: 'Document 1 - Completed' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Document 1 - Draft' })).toBeVisible();

  await apiSignout({ page });

  for (const recipient of recipients) {
    await apiSignin({
      page,
      email: recipient.user.email,
      redirectPath: `/t/${recipient.team.url}/documents`,
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
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  // Open document action menu.
  await page
    .locator('tr', { hasText: 'Document 1 - Completed' })
    .getByTestId('document-table-action-btn')
    .click();

  await page.waitForTimeout(200);

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForTimeout(2500);

  await expect(page.getByRole('row', { name: /Document 1 - Completed/ })).not.toBeVisible();

  await apiSignout({ page });

  for (const recipient of recipients) {
    await apiSignin({
      page,
      email: recipient.user.email,
      redirectPath: `/t/${recipient.team.url}/documents`,
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
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  // Open document action menu.
  await page
    .locator('tr', { hasText: 'Document 1 - Pending' })
    .getByTestId('document-table-action-btn')
    .click();

  await page.waitForTimeout(200);

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForTimeout(2500);

  await expect(page.getByRole('row', { name: /Document 1 - Pending/ })).not.toBeVisible();

  // signout
  await apiSignout({ page });

  for (const recipient of pendingDocument.recipients) {
    await apiSignin({
      page,
      email: recipient.email,
    });

    // Check dashboard inbox.
    await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).not.toBeVisible();
    await apiSignout({ page });
  }
});

test('[DOCUMENTS]: deleting draft documents should permanently remove it', async ({ page }) => {
  const { sender } = await seedDeleteDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  // Open document action menu.
  await page
    .locator('tr', { hasText: 'Document 1 - Draft' })
    .getByTestId('document-table-action-btn')
    .click();

  await page.waitForTimeout(200);

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByPlaceholder("Type 'delete' to confirm")).not.toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForTimeout(2500);

  await expect(page.getByRole('row', { name: /Document 1 - Draft/ })).not.toBeVisible();

  // Check document counts.
  await checkDocumentTabCount(page, 'Inbox', 0);
  await checkDocumentTabCount(page, 'Pending', 1);
  await checkDocumentTabCount(page, 'Completed', 1);
  await checkDocumentTabCount(page, 'Draft', 0);
  await checkDocumentTabCount(page, 'All', 2);
});

test('[DOCUMENTS]: deleting pending documents should permanently remove it', async ({ page }) => {
  const { sender } = await seedDeleteDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  // Open document action menu.
  await page
    .locator('tr', { hasText: 'Document 1 - Pending' })
    .getByTestId('document-table-action-btn')
    .click();

  await page.waitForTimeout(200);

  // Delete document.
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForTimeout(2500);

  await expect(page.getByRole('row', { name: /Document 1 - Pending/ })).not.toBeVisible();

  // Check document counts.
  await checkDocumentTabCount(page, 'Inbox', 0);
  await checkDocumentTabCount(page, 'Pending', 0);
  await checkDocumentTabCount(page, 'Completed', 1);
  await checkDocumentTabCount(page, 'Draft', 1);
  await checkDocumentTabCount(page, 'All', 2);
});

test('[DOCUMENTS]: deleting completed documents as an owner should hide it from only the owner', async ({
  page,
}) => {
  const { sender, recipients } = await seedDeleteDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  // Open document action menu.
  await page
    .locator('tr', { hasText: 'Document 1 - Completed' })
    .getByTestId('document-table-action-btn')
    .click();

  await page.waitForTimeout(200);

  // Delete document.
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForTimeout(2500);

  // Check document counts.
  await expect(page.getByRole('row', { name: /Document 1 - Completed/ })).not.toBeVisible();
  await checkDocumentTabCount(page, 'Inbox', 0);
  await checkDocumentTabCount(page, 'Pending', 1);
  await checkDocumentTabCount(page, 'Completed', 0);
  await checkDocumentTabCount(page, 'Draft', 1);
  await checkDocumentTabCount(page, 'All', 2);

  // Sign into the recipient account.
  await apiSignout({ page });
  await apiSignin({
    page,
    email: recipients[0].user.email,
    redirectPath: `/t/${recipients[0].team.url}/documents`,
  });

  // Check document counts.
  await expect(page.getByRole('row', { name: /Document 1 - Completed/ })).toBeVisible();
  await checkDocumentTabCount(page, 'Inbox', 1);
  await checkDocumentTabCount(page, 'Pending', 0);
  await checkDocumentTabCount(page, 'Completed', 1);
  await checkDocumentTabCount(page, 'Draft', 0);
  await checkDocumentTabCount(page, 'All', 2);
});

test('[DOCUMENTS]: deleting documents as a recipient should only hide it for them', async ({
  page,
}) => {
  const { sender, recipients } = await seedDeleteDocumentsTestRequirements();
  const recipientA = recipients[0];
  const recipientB = recipients[1];

  await apiSignin({
    page,
    email: recipientA.user.email,
    redirectPath: `/t/${recipientA.team.url}/documents`,
  });

  // Open document action menu.
  await expect(async () => {
    await page
      .locator('tr', { hasText: 'Document 1 - Completed' })
      .getByTestId('document-table-action-btn')
      .click();

    await page.waitForTimeout(1000);

    await expect(page.getByRole('menuitem', { name: 'Hide' })).toBeVisible();
  }).toPass();

  // Delete document.
  await page.getByRole('menuitem', { name: 'Hide' }).waitFor({ state: 'visible' });
  await page.getByRole('menuitem', { name: 'Hide' }).click({ force: true });
  await page.getByRole('button', { name: 'Hide' }).click({ force: true });
  await page.waitForTimeout(2000);

  await expect(async () => {
    await page
      .locator('tr', { hasText: 'Document 1 - Pending' })
      .getByTestId('document-table-action-btn')
      .click();

    await page.waitForTimeout(1000);

    await expect(page.getByRole('menuitem', { name: 'Hide' })).toBeVisible();
  }).toPass();

  // Delete document.
  await page.getByRole('menuitem', { name: 'Hide' }).waitFor({ state: 'visible' });
  await page.getByRole('menuitem', { name: 'Hide' }).click({ force: true });
  await page.getByRole('button', { name: 'Hide' }).click({ force: true });

  await page.waitForTimeout(2500);

  // Check document counts.
  await expect(page.getByRole('row', { name: /Document 1 - Completed/ })).not.toBeVisible();
  await expect(page.getByRole('row', { name: /Document 1 - Pending/ })).not.toBeVisible();
  await checkDocumentTabCount(page, 'Inbox', 0);
  await checkDocumentTabCount(page, 'Pending', 0);
  await checkDocumentTabCount(page, 'Completed', 0);
  await checkDocumentTabCount(page, 'Draft', 0);
  await checkDocumentTabCount(page, 'All', 0);

  // Sign into the sender account.
  await apiSignout({ page });
  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  // Check document counts for sender.
  await checkDocumentTabCount(page, 'Inbox', 0);
  await checkDocumentTabCount(page, 'Pending', 1);
  await checkDocumentTabCount(page, 'Completed', 1);
  await checkDocumentTabCount(page, 'Draft', 1);
  await checkDocumentTabCount(page, 'All', 3);

  // Sign into the other recipient account.
  await apiSignout({ page });
  await apiSignin({
    page,
    email: recipientB.user.email,
    redirectPath: `/t/${recipientB.team.url}/documents`,
  });

  // Check document counts for other recipient.
  await checkDocumentTabCount(page, 'Inbox', 1);
  await checkDocumentTabCount(page, 'Pending', 0);
  await checkDocumentTabCount(page, 'Completed', 1);
  await checkDocumentTabCount(page, 'Draft', 0);
  await checkDocumentTabCount(page, 'All', 2);
});
