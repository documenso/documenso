import { expect, test } from '@playwright/test';
import path from 'node:path';

import { FolderType } from '@documenso/prisma/client';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('create folder button is visible on documents page', async ({ page }) => {
  const user = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/',
  });

  await expect(page.getByRole('button', { name: 'Create Folder' })).toBeVisible();
});

test('user can create a document folder', async ({ page }) => {
  const user = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/',
  });

  await page.getByRole('button', { name: 'Create Folder' }).click();
  await expect(page.getByRole('dialog', { name: 'Create New folder' })).toBeVisible();

  await page.getByLabel('Folder name').fill('My folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('My folder')).toBeVisible();

  await page.goto('/documents');
  await expect(page.locator('div').filter({ hasText: 'My folder' }).nth(3)).toBeVisible();
});

test('user can create a document subfolder inside a document folder', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Client Contracts',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/f/${folder.id}`,
  });

  await expect(page.getByText('Client Contracts')).toBeVisible();

  await page.getByRole('button', { name: 'Create Folder' }).click();
  await expect(page.getByRole('dialog', { name: 'Create New folder' })).toBeVisible();

  await page.getByLabel('Folder name').fill('Invoices');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('Invoices')).toBeVisible();
});

test('user can create a document inside a document folder', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Client Contracts',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/f/${folder.id}`,
  });

  const fileInput = page.locator('input[type="file"]').nth(1);
  await fileInput.waitFor({ state: 'attached' });

  await fileInput.setInputFiles(
    path.join(__dirname, '../../../assets/documenso-supporter-pledge.pdf'),
  );

  await page.waitForTimeout(3000);

  await expect(page.getByText('documenso-supporter-pledge.pdf')).toBeVisible();

  await page.goto(`/documents/f/${folder.id}`);

  await expect(page.getByText('documenso-supporter-pledge.pdf')).toBeVisible();
});

test('user can pin a document folder', async ({ page }) => {
  const user = await seedUser();

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contracts',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/documents',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Pin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).toBeVisible();
});

test('user can unpin a document folder', async ({ page }) => {
  const user = await seedUser();

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contracts',
      pinned: true,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/documents',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Unpin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).not.toBeVisible();
});

test('user can rename a document folder', async ({ page }) => {
  const user = await seedUser();

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contracts',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/documents',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await page.getByLabel('Name').fill('Archive');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Archive')).toBeVisible();
});

test('document folder visibility is not visible to user', async ({ page }) => {
  const user = await seedUser();

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contracts',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/documents',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('menuitem', { name: 'Visibility' })).not.toBeVisible();
});

test('document folder can be moved to another document folder', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Clients',
    },
  });

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contracts',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/documents',
  });

  await page.getByRole('button', { name: '•••' }).nth(0).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();

  await page.getByRole('button', { name: 'Clients' }).click();
  await page.getByRole('button', { name: 'Move Folder' }).click();

  await page.waitForTimeout(1000);

  await page.goto(`/documents/f/${folder.id}`);

  await expect(page.getByText('Contracts')).toBeVisible();
});

test('document folder can be moved to the root', async ({ page }) => {
  const user = await seedUser();

  const parentFolder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Clients',
    },
  });

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contracts',
      parentId: parentFolder.id,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/documents',
  });

  await page.getByText('Clients').click();

  await page.getByRole('button', { name: '•••' }).nth(0).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();

  await page.getByRole('button', { name: 'Root' }).click();
  await page.getByRole('button', { name: 'Move Folder' }).click();

  await page.waitForTimeout(1000);

  await page.goto('/documents');

  await expect(page.getByText('Clients')).toBeVisible();
});

test('document folder and its contents can be deleted', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Proposals',
    },
  });

  const proposal = await seedBlankDocument(user, {
    createDocumentOptions: {
      title: 'Proposal 1',
      folderId: folder.id,
    },
  });

  const reportsFolder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Reports',
      parentId: folder.id,
    },
  });

  const report = await seedBlankDocument(user, {
    createDocumentOptions: {
      title: 'Report 1',
      folderId: reportsFolder.id,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/documents',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  await page.getByRole('textbox').fill(`delete ${folder.name}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.goto('/documents');

  await expect(page.locator('div').filter({ hasText: folder.name })).not.toBeVisible();
  await expect(page.getByText(proposal.title)).not.toBeVisible();

  await page.goto(`/documents/f/${folder.id}`);

  await expect(page.getByText(report.title)).not.toBeVisible();
  await expect(page.locator('div').filter({ hasText: reportsFolder.name })).not.toBeVisible();
});

test('user can move a document to a document folder', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Proposals',
    },
  });

  await seedBlankDocument(user, {
    createDocumentOptions: {
      title: 'Proposal 1',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/documents',
  });

  await page.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await page.getByRole('button', { name: 'Proposals' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);

  await page.goto(`/documents/f/${folder.id}`);

  await expect(page.getByText('Proposal 1')).toBeVisible();
});

test('user can move a document from folder to the root', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Proposals',
    },
  });

  await seedBlankDocument(user, {
    createDocumentOptions: {
      title: 'Proposal 1',
      folderId: folder.id,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/documents',
  });

  await page.getByText('Proposals').click();

  await page.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).waitFor({ state: 'visible' });
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click({ force: true });

  await page.getByRole('button', { name: 'Root' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);

  await page.goto('/documents');

  await expect(page.getByText('Proposal 1')).toBeVisible();
});

test('create folder button is visible on templates page', async ({ page }) => {
  const user = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await expect(page.getByRole('button', { name: 'Create folder' })).toBeVisible();
});

test('user can create a template folder', async ({ page }) => {
  const user = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByRole('button', { name: 'Create folder' }).click();
  await expect(page.getByRole('dialog', { name: 'Create New folder' })).toBeVisible();

  await page.getByLabel('Folder name').fill('My template folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('My template folder')).toBeVisible();

  await page.goto('/templates');
  await expect(page.locator('div').filter({ hasText: 'My template folder' }).nth(3)).toBeVisible();
});

test('user can create a template subfolder inside a template folder', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Client Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/f/${folder.id}`,
  });

  await expect(page.getByText('Client Templates')).toBeVisible();

  await page.getByRole('button', { name: 'Create folder' }).click();
  await expect(page.getByRole('dialog', { name: 'Create New folder' })).toBeVisible();

  await page.getByLabel('Folder name').fill('Contract Templates');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('Contract Templates')).toBeVisible();
});

test('user can create a template inside a template folder', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Client Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/f/${folder.id}`,
  });

  await expect(page.getByText('Client Templates')).toBeVisible();

  await page.getByRole('button', { name: 'New Template' }).click();
  // await expect(page.getByRole('dialog', { name: 'New Template' })).toBeVisible();

  await page
    .locator('div')
    .filter({ hasText: /^Upload Template DocumentDrag & drop your PDF here\.$/ })
    .nth(2)
    .click();
  await page.locator('input[type="file"]').waitFor({ state: 'attached' });

  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, '../../../assets/documenso-supporter-pledge.pdf'));

  await page.waitForTimeout(3000);

  await page.getByRole('button', { name: 'Create' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('documenso-supporter-pledge.pdf')).toBeVisible();

  await page.goto(`/templates/f/${folder.id}`);
  await expect(page.getByText('documenso-supporter-pledge.pdf')).toBeVisible();
});

test('user can pin a template folder', async ({ page }) => {
  const user = await seedUser();

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contract Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Pin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).toBeVisible();
});

test('user can unpin a template folder', async ({ page }) => {
  const user = await seedUser();

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contract Templates',
      pinned: true,
      type: FolderType.TEMPLATE,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Unpin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).not.toBeVisible();
});

test('user can rename a template folder', async ({ page }) => {
  const user = await seedUser();

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contract Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await page.getByLabel('Name').fill('Updated Template Folder');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Updated Template Folder')).toBeVisible();
});

test('template folder visibility is not visible to user', async ({ page }) => {
  const user = await seedUser();

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contract Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('menuitem', { name: 'Visibility' })).not.toBeVisible();
});

test('template folder can be moved to another template folder', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Client Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contract Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByRole('button', { name: '•••' }).nth(0).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();

  await page.getByRole('button', { name: 'Client Templates' }).click();
  await page.getByRole('button', { name: 'Move Folder' }).click();

  await page.waitForTimeout(1000);

  await page.goto(`/templates/f/${folder.id}`);

  await expect(page.getByText('Contract Templates')).toBeVisible();
});

test('template folder can be moved to the root', async ({ page }) => {
  const user = await seedUser();

  const parentFolder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Client Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contract Templates',
      parentId: parentFolder.id,
      type: FolderType.TEMPLATE,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByText('Client Templates').click();
  await page.getByRole('button', { name: '•••' }).nth(0).click();
  await page.getByRole('menuitem', { name: 'Move' }).click({ force: true });

  await page.getByRole('button', { name: 'Root' }).click();
  await page.getByRole('button', { name: 'Move Folder' }).click({ force: true });

  await page.waitForTimeout(1000);

  await page.goto('/templates');

  await expect(page.getByText('Contract Templates')).toBeVisible();
});

test('template folder and its contents can be deleted', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Proposal Templates',
      type: FolderType.TEMPLATE,
    },
  });

  const template = await seedBlankTemplate(user, {
    createTemplateOptions: {
      title: 'Proposal Template 1',
      folderId: folder.id,
    },
  });

  const subfolder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Report Templates',
      parentId: folder.id,
      type: FolderType.TEMPLATE,
    },
  });

  const reportTemplate = await seedBlankTemplate(user, {
    createTemplateOptions: {
      title: 'Report Template 1',
      folderId: subfolder.id,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  await page.getByRole('textbox').fill(`delete ${folder.name}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.goto('/templates');

  await expect(page.locator('div').filter({ hasText: folder.name })).not.toBeVisible();
  await expect(page.getByText(template.title)).not.toBeVisible();

  await page.goto(`/templates/f/${folder.id}`);

  await expect(page.getByText(reportTemplate.title)).not.toBeVisible();
  await expect(page.locator('div').filter({ hasText: subfolder.name })).not.toBeVisible();
});

test('user can navigate between template folders', async ({ page }) => {
  const user = await seedUser();

  const parentFolder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Client Templates',
      type: FolderType.TEMPLATE,
    },
  });

  const subfolder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Contract Templates',
      parentId: parentFolder.id,
      type: FolderType.TEMPLATE,
    },
  });

  await seedBlankTemplate(user, {
    createTemplateOptions: {
      title: 'Contract Template 1',
      folderId: subfolder.id,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByText('Client Templates').click();
  await expect(page.getByText('Contract Templates')).toBeVisible();

  await page.getByText('Contract Templates').click();
  await expect(page.getByText('Contract Template 1')).toBeVisible();

  await page.getByRole('button', { name: parentFolder.name }).click();
  await expect(page.getByText('Contract Templates')).toBeVisible();

  await page.getByRole('button', { name: subfolder.name }).click();
  await expect(page.getByText('Contract Template 1')).toBeVisible();
});

test('user can move a template to a template folder', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Client Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await seedBlankTemplate(user, {
    createTemplateOptions: {
      title: 'Proposal Template 1',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByTestId('template-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await page.getByRole('button', { name: 'Client Templates' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.goto(`/templates/f/${folder.id}`);
  await page.waitForTimeout(1000);

  await expect(page.getByText('Proposal Template 1')).toBeVisible();
});

test('user can move a template from a folder to the root', async ({ page }) => {
  const user = await seedUser();

  const folder = await seedBlankFolder(user, {
    createFolderOptions: {
      name: 'Client Templates',
      type: FolderType.TEMPLATE,
    },
  });

  await seedBlankTemplate(user, {
    createTemplateOptions: {
      title: 'Proposal Template 1',
      folderId: folder.id,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/templates',
  });

  await page.getByText('Client Templates').click();

  await page.getByTestId('template-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await page.getByRole('button', { name: 'Root' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);

  await page.goto('/templates');

  await expect(page.getByText('Proposal Template 1')).toBeVisible();
});
