import { expect, test } from '@playwright/test';

import { FolderType } from '@documenso/prisma/client';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { expectToastTextToBeVisible } from '../fixtures/generic';

test.describe.configure({ mode: 'parallel' });

const seedBulkActionsTestRequirements = async () => {
  const sender = await seedUser({ setTeamEmailAsOwner: true });

  const [template1, template2, template3] = await Promise.all([
    seedBlankTemplate(sender.user, sender.team.id, {
      createTemplateOptions: { title: 'Bulk Test Template 1' },
    }),
    seedBlankTemplate(sender.user, sender.team.id, {
      createTemplateOptions: { title: 'Bulk Test Template 2' },
    }),
    seedBlankTemplate(sender.user, sender.team.id, {
      createTemplateOptions: { title: 'Bulk Test Template 3' },
    }),
  ]);

  const folder = await seedBlankFolder(sender.user, sender.team.id, {
    createFolderOptions: {
      name: 'Target Template Folder',
      teamId: sender.team.id,
      type: FolderType.TEMPLATE,
    },
  });

  return {
    sender,
    templates: [template1, template2, template3],
    folder,
  };
};

test('[BULK_ACTIONS]: can select multiple templates with checkboxes', async ({ page }) => {
  const { sender } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/templates`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Template 1' }).getByRole('checkbox').click();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.locator('tr', { hasText: 'Bulk Test Template 2' }).getByRole('checkbox').click();
  await expect(page.getByText('2 selected')).toBeVisible();
});

test('[BULK_ACTIONS]: header checkbox selects all templates on page', async ({ page }) => {
  const { sender, templates } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/templates`,
  });

  await page.locator('thead').getByRole('checkbox').click();

  await expect(page.getByText(`${templates.length} selected`)).toBeVisible();
});

test('[BULK_ACTIONS]: can clear selection with X button', async ({ page }) => {
  const { sender } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/templates`,
  });

  await page.locator('thead').getByRole('checkbox').click();
  await expect(page.getByText(/\d+ selected/)).toBeVisible();

  await page.getByLabel('Clear selection').click();

  await expect(page.getByText(/\d+ selected/)).not.toBeVisible();
});

test('[BULK_ACTIONS]: can move multiple templates to a folder', async ({ page }) => {
  const { sender, folder } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/templates`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Template 1' }).getByRole('checkbox').click();
  await page.locator('tr', { hasText: 'Bulk Test Template 2' }).getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Move Templates to Folder')).toBeVisible();

  await page.getByRole('button', { name: folder.name }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await expectToastTextToBeVisible(page, 'Selected items have been moved.');

  await page.goto(`/t/${sender.team.url}/templates/f/${folder.id}`);
  await expect(page.getByRole('link', { name: 'Bulk Test Template 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bulk Test Template 2' })).toBeVisible();
});

test('[BULK_ACTIONS]: can delete multiple templates', async ({ page }) => {
  const { sender } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/templates`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Template 1' }).getByRole('checkbox').click();
  await page.locator('tr', { hasText: 'Bulk Test Template 2' }).getByRole('checkbox').click();

  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Delete Templates')).toBeVisible();
  await expect(page.getByText('You are about to delete 2 templates')).toBeVisible();
  await expect(page.getByText('irreversible')).toBeVisible();

  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expectToastTextToBeVisible(page, 'Templates deleted');

  await expect(page.getByRole('link', { name: 'Bulk Test Template 1' })).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'Bulk Test Template 2' })).not.toBeVisible();

  await expect(page.getByRole('link', { name: 'Bulk Test Template 3' })).toBeVisible();
});

test('[BULK_ACTIONS]: selection clears after successful move', async ({ page }) => {
  const { sender, folder } = await seedBulkActionsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/templates`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Template 1' }).getByRole('checkbox').click();
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
    redirectPath: `/t/${sender.team.url}/templates`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Template 1' }).getByRole('checkbox').click();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expectToastTextToBeVisible(page, 'Templates deleted');
  await expect(page.getByText(/\d+ selected/)).not.toBeVisible();
});

test('[BULK_ACTIONS]: can search for folders in move dialog', async ({ page }) => {
  const { sender, folder } = await seedBulkActionsTestRequirements();

  const otherFolder = await seedBlankFolder(sender.user, sender.team.id, {
    createFolderOptions: {
      name: 'Other Template Folder',
      teamId: sender.team.id,
      type: FolderType.TEMPLATE,
    },
  });

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/templates`,
  });

  await page.locator('tr', { hasText: 'Bulk Test Template 1' }).getByRole('checkbox').click();

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

test('[BULK_ACTIONS]: can move templates from folder to home (root)', async ({ page }) => {
  const { sender, templates, folder } = await seedBulkActionsTestRequirements();

  const { prisma } = await import('@documenso/prisma');

  await prisma.envelope.updateMany({
    where: { id: templates[0].id },
    data: { folderId: folder.id },
  });

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/templates/f/${folder.id}`,
  });

  await expect(page.getByRole('link', { name: 'Bulk Test Template 1' })).toBeVisible();

  await page.locator('tr', { hasText: 'Bulk Test Template 1' }).getByRole('checkbox').click();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Move to Folder' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByRole('button', { name: 'Home (No Folder)' }).click();

  await page.getByRole('button', { name: 'Move' }).click();

  await expectToastTextToBeVisible(page, 'Selected items have been moved.');

  await page.goto(`/t/${sender.team.url}/templates`);
  await expect(page.getByRole('link', { name: 'Bulk Test Template 1' })).toBeVisible();

  await page.goto(`/t/${sender.team.url}/templates/f/${folder.id}`);
  await expect(page.getByRole('link', { name: 'Bulk Test Template 1' })).not.toBeVisible();
});
