import { prisma } from '@documenso/prisma';
import { seedCompletedDocument, seedDraftDocument, seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentStatus, TeamMemberRole } from '@prisma/client';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import { expectToastTextToBeVisible } from '../fixtures/generic';

test.describe.configure({ mode: 'parallel' });

const seedBulkActionsTestRequirements = async () => {
  const sender = await seedUser({ setTeamEmailAsOwner: true });

  const [doc1, doc2, doc3] = await Promise.all([
    seedDraftDocument(sender.user, sender.team.id, [], {
      createDocumentOptions: { title: 'Bulk Test Doc 1' },
    }),
    seedDraftDocument(sender.user, sender.team.id, [], {
      createDocumentOptions: { title: 'Bulk Test Doc 2' },
    }),
    seedDraftDocument(sender.user, sender.team.id, [], {
      createDocumentOptions: { title: 'Bulk Test Doc 3' },
    }),
  ]);

  const folder = await seedBlankFolder(sender.user, sender.team.id, {
    createFolderOptions: {
      name: 'Target Folder',
      teamId: sender.team.id,
    },
  });

  return {
    sender,
    documents: [doc1, doc2, doc3],
    folder,
  };
};

test('[BULK_ACTIONS]: can select multiple documents with checkboxes', async ({ page }) => {
  const { sender } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Doc 1' }).getByRole('checkbox').click();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.locator('tr', { hasText: 'Bulk Test Doc 2' }).getByRole('checkbox').click();
  await expect(page.getByText('2 selected')).toBeVisible();
});

test('[BULK_ACTIONS]: header checkbox selects all documents on page', async ({ page }) => {
  const { sender, documents } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('thead').getByRole('checkbox').click();

  await expect(page.getByText(`${documents.length} selected`)).toBeVisible();
});

test('[BULK_ACTIONS]: can clear selection with X button', async ({ page }) => {
  const { sender } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('thead').getByRole('checkbox').click();
  await expect(page.getByText(/\d+ selected/)).toBeVisible();

  await page.getByLabel('Clear selection').click();

  await expect(page.getByText(/\d+ selected/)).not.toBeVisible();
});

test('[BULK_ACTIONS]: can move multiple documents to a folder', async ({ page }) => {
  const { sender, folder } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Doc 1' }).getByRole('checkbox').click();
  await page.locator('tr', { hasText: 'Bulk Test Doc 2' }).getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Move Documents to Folder')).toBeVisible();

  await page.getByRole('button', { name: folder.name }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await expectToastTextToBeVisible(page, 'Selected items have been moved.');

  await page.goto(`/t/${sender.team.url}/documents/f/${folder.id}`);
  await expect(page.getByRole('link', { name: 'Bulk Test Doc 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bulk Test Doc 2' })).toBeVisible();
});

test('[BULK_ACTIONS]: can delete multiple draft documents', async ({ page }) => {
  const { sender } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Doc 1' }).getByRole('checkbox').click();
  await page.locator('tr', { hasText: 'Bulk Test Doc 2' }).getByRole('checkbox').click();

  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Delete Documents')).toBeVisible();
  await expect(page.getByText('You are about to delete 2 documents')).toBeVisible();
  await expect(page.getByText('irreversible')).toBeVisible();

  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expectToastTextToBeVisible(page, 'Documents deleted');

  await expect(page.getByRole('link', { name: 'Bulk Test Doc 1' })).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'Bulk Test Doc 2' })).not.toBeVisible();

  await expect(page.getByRole('link', { name: 'Bulk Test Doc 3' })).toBeVisible();
});

test('[BULK_ACTIONS]: selection clears after successful move', async ({ page }) => {
  const { sender, folder } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Doc 1' }).getByRole('checkbox').click();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Move to Folder' }).click();
  await page.getByRole('button', { name: folder.name }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await expectToastTextToBeVisible(page, 'Selected items have been moved.');
  await expect(page.getByText(/\d+ selected/)).not.toBeVisible();
});

test('[BULK_ACTIONS]: selection clears after successful delete', async ({ page }) => {
  const { sender } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Doc 1' }).getByRole('checkbox').click();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expectToastTextToBeVisible(page, 'Documents deleted');
  await expect(page.getByText(/\d+ selected/)).not.toBeVisible();
});

test('[BULK_ACTIONS]: can search for folders in move dialog', async ({ page }) => {
  const { sender, folder } = await seedBulkActionsTestRequirements();

  const otherFolder = await seedBlankFolder(sender.user, sender.team.id, {
    createFolderOptions: {
      name: 'Other Folder',
      teamId: sender.team.id,
    },
  });

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Doc 1' }).getByRole('checkbox').click();

  await page.getByRole('button', { name: 'Move to Folder' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await expect(page.getByRole('button', { name: folder.name })).toBeVisible();
  await expect(page.getByRole('button', { name: otherFolder.name })).toBeVisible();

  await page.getByPlaceholder('Search folders...').fill('Target');
  await expect(page.getByRole('button', { name: folder.name })).toBeVisible();
  await expect(page.getByRole('button', { name: otherFolder.name })).not.toBeVisible();

  await page.getByPlaceholder('Search folders...').fill('Other');
  await expect(page.getByRole('button', { name: folder.name })).not.toBeVisible();
  await expect(page.getByRole('button', { name: otherFolder.name })).toBeVisible();

  await page.getByPlaceholder('Search folders...').fill('NonExistent');
  await expect(page.getByText('No folders found')).toBeVisible();
});

test('[BULK_ACTIONS]: can move documents from folder to home (root)', async ({ page }) => {
  const { sender, documents, folder } = await seedBulkActionsTestRequirements();

  const { prisma } = await import('@documenso/prisma');

  await prisma.envelope.updateMany({
    where: { id: documents[0].id },
    data: { folderId: folder.id },
  });

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents/f/${folder.id}`,
  });

  await expect(page.getByRole('link', { name: 'Bulk Test Doc 1' })).toBeVisible();

  await page.locator('tr', { hasText: 'Bulk Test Doc 1' }).getByRole('checkbox').click();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Move to Folder' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByRole('button', { name: 'Home (No Folder)' }).click();

  await page.getByRole('button', { name: 'Move' }).click();

  await expectToastTextToBeVisible(page, 'Selected items have been moved.');

  await page.goto(`/t/${sender.team.url}/documents`);
  await expect(page.getByRole('link', { name: 'Bulk Test Doc 1' })).toBeVisible();

  await page.goto(`/t/${sender.team.url}/documents/f/${folder.id}`);
  await expect(page.getByRole('link', { name: 'Bulk Test Doc 1' })).not.toBeVisible();
});

// ─── Bulk cancel ─────────────────────────────────────────────────────────────

test('[BULK_ACTIONS]: can cancel multiple pending documents', async ({ page }) => {
  const sender = await seedUser({ setTeamEmailAsOwner: true });
  const { user: recipient } = await seedUser();

  const [pending1, pending2] = await Promise.all([
    seedPendingDocument(sender.user, sender.team.id, [recipient], {
      createDocumentOptions: { title: 'Bulk Cancel Pending 1' },
    }),
    seedPendingDocument(sender.user, sender.team.id, [recipient], {
      createDocumentOptions: { title: 'Bulk Cancel Pending 2' },
    }),
  ]);

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('tr', { hasText: 'Bulk Cancel Pending 1' }).getByRole('checkbox').click();
  await page.locator('tr', { hasText: 'Bulk Cancel Pending 2' }).getByRole('checkbox').click();
  await expect(page.getByText('2 selected')).toBeVisible();

  // The bulk action bar Cancel button (distinct from the dialog's confirm button).
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Cancel Documents' })).toBeVisible();
  await expect(dialog.getByText('You are about to cancel 2 documents')).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel documents' }).click();

  await expectToastTextToBeVisible(page, 'Documents cancelled');

  // Selection clears after a successful cancel.
  await expect(page.getByText(/\d+ selected/)).not.toBeVisible();

  // Both documents are now cancelled in the database.
  for (const document of [pending1, pending2]) {
    const envelope = await prisma.envelope.findFirstOrThrow({
      where: { id: document.id },
      select: { status: true, deletedAt: true },
    });

    expect(envelope.status).toBe(DocumentStatus.CANCELLED);
    expect(envelope.deletedAt).toBeNull();
  }
});

test('[BULK_ACTIONS]: bulk cancel only affects pending documents', async ({ page }) => {
  const sender = await seedUser({ setTeamEmailAsOwner: true });
  const { user: recipient } = await seedUser();

  const pending = await seedPendingDocument(sender.user, sender.team.id, [recipient], {
    createDocumentOptions: { title: 'Mixed Cancel Pending' },
  });
  const draft = await seedDraftDocument(sender.user, sender.team.id, [], {
    createDocumentOptions: { title: 'Mixed Cancel Draft' },
  });
  const completed = await seedCompletedDocument(sender.user, sender.team.id, [recipient], {
    createDocumentOptions: { title: 'Mixed Cancel Completed' },
  });

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await page.locator('thead').getByRole('checkbox').click();
  await expect(page.getByText('3 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel documents' }).click();

  // Only one of the three was pending, so this is a partial result.
  await expectToastTextToBeVisible(page, 'Documents partially cancelled');

  const pendingEnvelope = await prisma.envelope.findFirstOrThrow({
    where: { id: pending.id },
    select: { status: true },
  });
  expect(pendingEnvelope.status).toBe(DocumentStatus.CANCELLED);

  // The draft and completed documents are untouched.
  const draftEnvelope = await prisma.envelope.findFirstOrThrow({
    where: { id: draft.id },
    select: { status: true },
  });
  expect(draftEnvelope.status).toBe(DocumentStatus.DRAFT);

  const completedEnvelope = await prisma.envelope.findFirstOrThrow({
    where: { id: completed.id },
    select: { status: true },
  });
  expect(completedEnvelope.status).toBe(DocumentStatus.COMPLETED);
});

test('[BULK_ACTIONS]: a MEMBER cannot bulk cancel documents they do not own', async ({ page }) => {
  const { team, owner } = await seedTeam();

  const memberUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  const { user: recipient } = await seedUser();

  const ownerDocument = await seedPendingDocument(owner, team.id, [recipient], {
    createDocumentOptions: { title: 'Member Cannot Cancel This', visibility: 'EVERYONE' },
  });

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents?status=PENDING`,
  });

  await page.locator('tr', { hasText: 'Member Cannot Cancel This' }).getByRole('checkbox').click();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel documents' }).click();

  // The server rejects the cancellation for a document the MEMBER does not own,
  // so it reports zero cancelled (a partial result with the document in failedIds).
  await expectToastTextToBeVisible(page, 'Documents partially cancelled');

  // The document remains pending.
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: ownerDocument.id },
    select: { status: true },
  });
  expect(envelope.status).toBe(DocumentStatus.PENDING);

  await apiSignout({ page });
});
