import { expect, test } from '@playwright/test';
import path from 'node:path';

import { prisma } from '@documenso/prisma';
import { DocumentVisibility, FolderType, TeamMemberRole } from '@documenso/prisma/client';
import { seedTeamDocuments } from '@documenso/prisma/seed/documents';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[TEAMS]: create document folder button is visible', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}`,
  });

  await expect(page.getByRole('button', { name: 'Create Folder' })).toBeVisible();
});

test('[TEAMS]: can create document folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}`,
  });

  await page.getByRole('button', { name: 'Create Folder' }).click();

  await page.getByLabel('Folder name').fill('Team Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Team Folder')).toBeVisible();
});

test('[TEAMS]: can create document subfolder within a document folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}`,
  });

  const teamFolder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Folder',
      teamId: team.id,
    },
  });

  await page.goto(`/t/${team.url}/documents/f/${teamFolder.id}`);

  await page.getByRole('button', { name: 'Create Folder' }).click();

  await page.getByLabel('Folder name').fill('Subfolder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Subfolder')).toBeVisible();
});

test('[TEAMS]: can create a document inside a document folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  const teamFolder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Documents',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents/f/${teamFolder.id}`,
  });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: 'attached' });

  await fileInput.setInputFiles(
    path.join(__dirname, '../../../assets/documenso-supporter-pledge.pdf'),
  );

  await page.waitForTimeout(3000);

  await expect(page.getByText('documenso-supporter-pledge.pdf')).toBeVisible();

  await page.goto(`/t/${team.url}/documents/f/${teamFolder.id}`);

  await expect(page.getByText('documenso-supporter-pledge.pdf')).toBeVisible();
});

test('[TEAMS]: can pin a document folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contracts',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Pin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).toBeVisible();
});

test('[TEAMS]: can unpin a document folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contracts',
      pinned: true,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Unpin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).not.toBeVisible();
});

test('[TEAMS]: can rename a document folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contracts',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await page.getByLabel('Name').fill('Team Archive');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Team Archive')).toBeVisible();
});

test('[TEAMS]: document folder visibility is visible to team member', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contracts',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('combobox', { name: 'Visibility' })).toBeVisible();
});

test('[TEAMS]: document folder can be moved to another document folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  const folder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Clients',
      teamId: team.id,
    },
  });

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contracts',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByRole('button', { name: '•••' }).nth(0).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();

  await page.getByRole('button', { name: 'Team Clients' }).click();
  await page.getByRole('button', { name: 'Move Folder' }).click();

  await page.waitForTimeout(1000);

  await page.goto(`/t/${team.url}/documents/f/${folder.id}`);

  await expect(page.getByText('Team Contracts')).toBeVisible();
});

test('[TEAMS]: document folder and its contents can be deleted', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  const folder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Proposals',
      teamId: team.id,
    },
  });

  const proposal = await seedBlankDocument(team.owner, {
    createDocumentOptions: {
      title: 'Team Proposal 1',
      folderId: folder.id,
    },
  });

  const reportsFolder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Reports',
      parentId: folder.id,
      teamId: team.id,
    },
  });

  const report = await seedBlankDocument(team.owner, {
    createDocumentOptions: {
      title: 'Team Report 1',
      folderId: reportsFolder.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  await page.getByRole('textbox').fill(`delete ${folder.name}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.goto(`/t/${team.url}/documents`);

  await expect(page.locator('div').filter({ hasText: folder.name })).not.toBeVisible();
  await expect(page.getByText(proposal.title)).not.toBeVisible();

  await page.goto(`/t/${team.url}/documents/f/${folder.id}`);

  await expect(page.getByText(report.title)).not.toBeVisible();
  await expect(page.locator('div').filter({ hasText: reportsFolder.name })).not.toBeVisible();
});

test('[TEAMS]: create folder button is visible on templates page', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await expect(page.getByRole('button', { name: 'Create Folder' })).toBeVisible();
});

test('[TEAMS]: can create a template folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: 'Create Folder' }).click();
  await expect(page.getByRole('dialog', { name: 'Create New folder' })).toBeVisible();

  await page.getByLabel('Folder name').fill('Team template folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('Team template folder')).toBeVisible();

  await page.goto(`/t/${team.url}/templates`);
  await expect(
    page.locator('div').filter({ hasText: 'Team template folder' }).nth(3),
  ).toBeVisible();
});

test('[TEAMS]: can create a template subfolder inside a template folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  const folder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Client Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates/f/${folder.id}`,
  });

  await expect(page.getByText('Team Client Templates')).toBeVisible();

  await page.getByRole('button', { name: 'Create Folder' }).click();
  await expect(page.getByRole('dialog', { name: 'Create New folder' })).toBeVisible();

  await page.getByLabel('Folder name').fill('Team Contract Templates');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('Team Contract Templates')).toBeVisible();
});

test('[TEAMS]: can create a template inside a template folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  const folder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Client Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates/f/${folder.id}`,
  });

  await expect(page.getByText('Team Client Templates')).toBeVisible();

  await page.getByRole('button', { name: 'New Template' }).click();

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

  await page.goto(`/t/${team.url}/templates/f/${folder.id}`);
  await expect(page.getByText('documenso-supporter-pledge.pdf')).toBeVisible();
});

test('[TEAMS]: can pin a template folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Pin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).toBeVisible();
});

test('[TEAMS]: can unpin a template folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      pinned: true,
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Unpin' }).click();

  await page.reload();
  await page.waitForTimeout(1000);

  await expect(page.locator('svg.text-documenso.h-3.w-3')).not.toBeVisible();
});

test('[TEAMS]: can rename a template folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await page.getByLabel('Name').fill('Updated Team Template Folder');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Updated Team Template Folder')).toBeVisible();
});

test('[TEAMS]: template folder visibility is not visible to team member', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('menuitem', { name: 'Visibility' })).not.toBeVisible();
});

test('[TEAMS]: template folder can be moved to another template folder', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  const folder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Client Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: '•••' }).nth(0).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();

  await page.getByRole('button', { name: 'Team Client Templates' }).click();
  await page.getByRole('button', { name: 'Move Folder' }).click();

  await page.waitForTimeout(1000);

  await page.goto(`/t/${team.url}/templates/f/${folder.id}`);

  await expect(page.getByText('Team Contract Templates')).toBeVisible();
});

test('[TEAMS]: template folder and its contents can be deleted', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  const folder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Proposal Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  const template = await seedBlankTemplate(team.owner, {
    createTemplateOptions: {
      title: 'Team Proposal Template 1',
      folderId: folder.id,
    },
  });

  const subfolder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Report Templates',
      parentId: folder.id,
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  const reportTemplate = await seedBlankTemplate(team.owner, {
    createTemplateOptions: {
      title: 'Team Report Template 1',
      folderId: subfolder.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  await page.getByRole('textbox').fill(`delete ${folder.name}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.goto(`/t/${team.url}/templates`);

  await expect(page.locator('div').filter({ hasText: folder.name })).not.toBeVisible();
  await expect(page.getByText(template.title)).not.toBeVisible();

  await page.goto(`/t/${team.url}/templates/f/${folder.id}`);

  await expect(page.getByText(reportTemplate.title)).not.toBeVisible();
  await expect(page.locator('div').filter({ hasText: subfolder.name })).not.toBeVisible();
});

test('[TEAMS]: can navigate between template folders', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  const parentFolder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Client Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  const subfolder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      parentId: parentFolder.id,
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await seedBlankTemplate(team.owner, {
    createTemplateOptions: {
      title: 'Team Contract Template 1',
      folderId: subfolder.id,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByText('Team Client Templates').click();
  await expect(page.getByText('Team Contract Templates')).toBeVisible();

  await page.getByText('Team Contract Templates').click();
  await expect(page.getByText('Team Contract Template 1')).toBeVisible();

  await page.getByRole('button', { name: parentFolder.name }).click();
  await expect(page.getByText('Team Contract Templates')).toBeVisible();

  await page.getByRole('button', { name: subfolder.name }).click();
  await expect(page.getByText('Team Contract Template 1')).toBeVisible();
});

test('[TEAMS]: folder visibility is properly applied based on team member roles', async ({
  page,
}) => {
  const { team } = await seedTeamDocuments();

  const teamMember1 = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member 1',
    role: TeamMemberRole.MEMBER,
  });

  const teamMember2 = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member 2',
    role: TeamMemberRole.MANAGER,
  });

  const teamMember3 = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member 3',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).toBeVisible();
  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('Everyone Folder')).toBeVisible();

  await apiSignin({
    page,
    email: teamMember1.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).not.toBeVisible();
  await expect(page.getByText('Manager Folder')).not.toBeVisible();
  await expect(page.getByText('Everyone Folder')).toBeVisible();

  await apiSignin({
    page,
    email: teamMember2.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).not.toBeVisible();
  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('Everyone Folder')).toBeVisible();

  await apiSignin({
    page,
    email: teamMember3.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).toBeVisible();
  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('Everyone Folder')).toBeVisible();
});

test('[TEAMS]: folder inherits team visibility settings', async ({ page }) => {
  const team = await seedTeam();

  await prisma.teamGlobalSettings.create({
    data: {
      teamId: team.id,
      documentVisibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByRole('button', { name: 'Create Folder' }).click();
  await page.getByLabel('Name').fill('Admin Only Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Admin Only Folder')).toBeVisible();

  await page.goto(`/t/${team.url}/documents/`);

  await page.getByRole('button', { name: '•••' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('combobox', { name: 'Visibility' })).toHaveText('Admins only');

  await prisma.teamGlobalSettings.update({
    where: { teamId: team.id },
    data: { documentVisibility: DocumentVisibility.MANAGER_AND_ABOVE },
  });

  await page.reload();

  await page.getByRole('button', { name: 'Create Folder' }).click();
  await page.getByLabel('Name').fill('Manager and above Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Manager and above Folder')).toBeVisible();

  await page.goto(`/t/${team.url}/documents/`);

  await page.getByRole('button', { name: '•••' }).nth(0).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('combobox', { name: 'Visibility' })).toHaveText('Managers and above');

  await prisma.teamGlobalSettings.update({
    where: { teamId: team.id },
    data: { documentVisibility: DocumentVisibility.EVERYONE },
  });

  await page.reload();

  await page.getByRole('button', { name: 'Create Folder' }).click();
  await page.getByLabel('Name').fill('Everyone Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Everyone Folder')).toBeVisible();

  await page.goto(`/t/${team.url}/documents/`);

  await page.getByRole('button', { name: '•••' }).nth(0).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('combobox', { name: 'Visibility' })).toHaveText('Everyone');
});

test('[TEAMS]: documents inherit folder visibility', async ({ page }) => {
  const team = await seedTeam();

  await prisma.teamGlobalSettings.create({
    data: {
      teamId: team.id,
      documentVisibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByRole('button', { name: 'Create Folder' }).click();
  await page.getByLabel('Name').fill('Admin Only Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Admin Only Folder')).toBeVisible();

  await page.getByText('Admin Only Folder').click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: 'attached' });

  await fileInput.setInputFiles(
    path.join(__dirname, '../../../assets/documenso-supporter-pledge.pdf'),
  );

  await page.waitForTimeout(3000);

  await expect(page.getByText('documenso-supporter-pledge.pdf')).toBeVisible();

  await expect(page.getByRole('combobox').filter({ hasText: 'Admins only' })).toBeVisible();
});

// added by ai below (needs fixing)
test('[TEAMS]: documents are properly organized within folders', async ({ page }) => {
  const { team } = await seedTeamDocuments();

  const folder = await seedBlankFolder(team.owner, {
    createFolderOptions: {
      name: 'Team Folder',
      teamId: team.id,
    },
  });

  await seedBlankDocument(team.owner, {
    createDocumentOptions: {
      title: 'Folder Document',
      folderId: folder.id,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Folder Document')).not.toBeVisible();

  await page.getByText('Team Folder').click();
  await page.waitForTimeout(1000);

  await expect(page.getByText('Folder Document')).toBeVisible();
});
