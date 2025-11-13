import { expect, test } from '@playwright/test';
import path from 'node:path';

import { prisma } from '@documenso/prisma';
import { DocumentVisibility, FolderType, TeamMemberRole } from '@documenso/prisma/client';
import { seedBlankDocument, seedTeamDocuments } from '@documenso/prisma/seed/documents';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';

import { apiSignin } from '../fixtures/authentication';
import { expectTextToBeVisible } from '../fixtures/generic';

test.describe.configure({ mode: 'parallel' });

test('[TEAMS]: create document folder button is visible', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}`,
  });

  await expect(page.getByTestId('folder-create-button')).toBeVisible();
});

test('[TEAMS]: can create document folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}`,
  });

  await page.getByTestId('folder-create-button').click();

  await page.getByLabel('Folder name').fill('Team Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Team Folder')).toBeVisible();
});

test('[TEAMS]: can create document subfolder within a document folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Folder',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents/f/${teamFolder.id}`,
  });

  await page.getByTestId('folder-create-button').click();

  await page.getByLabel('Folder name').fill('Subfolder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Subfolder')).toBeVisible();
});

test('[TEAMS]: can create a document inside a document folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Documents',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents/f/${teamFolder.id}`,
  });

  // Upload document.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Document (Legacy)' }).click(),
  ]);

  await fileChooser.setFiles(
    path.join(__dirname, '../../../assets/documenso-supporter-pledge.pdf'),
  );

  await page.waitForTimeout(3000);

  await expectTextToBeVisible(page, 'documenso-supporter-pledge.pdf');

  await page.goto(`/t/${team.url}/documents/f/${teamFolder.id}`);

  await expectTextToBeVisible(page, 'documenso-supporter-pledge.pdf');
});

test('[TEAMS]: can pin a document folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contracts',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Pin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).toBeVisible();
});

test('[TEAMS]: can unpin a document folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contracts',
      pinned: true,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Unpin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).not.toBeVisible();
});

test('[TEAMS]: can rename a document folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contracts',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await page.getByLabel('Name').fill('Team Archive');
  await page.getByRole('button', { name: 'Update' }).click();

  await expect(page.getByText('Team Archive')).toBeVisible();
});

test('[TEAMS]: document folder visibility is visible to team member', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contracts',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('combobox', { name: 'Visibility' })).toBeVisible();
});

test('[TEAMS]: document folder can be moved to another document folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const folder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Clients',
      teamId: team.id,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contracts',
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByTestId('folder-card-more-button').nth(0).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();

  await page.getByRole('button', { name: 'Team Clients' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);

  await page.goto(`/t/${team.url}/documents/f/${folder.id}`);

  await expect(page.getByText('Team Contracts')).toBeVisible();
});

test('[TEAMS]: document folder and its contents can be deleted', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const folder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Proposals',
      teamId: team.id,
    },
  });

  const proposal = await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Team Proposal 1',
      folderId: folder.id,
    },
  });

  const reportsFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Reports',
      parentId: folder.id,
      teamId: team.id,
    },
  });

  const report = await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Team Report 1',
      folderId: reportsFolder.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  await page.getByRole('textbox').fill(`delete ${folder.name}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.goto(`/t/${team.url}/documents`);

  await expect(page.locator(`[data-folder-id="${folder.id}"]`)).not.toBeVisible();
  await expect(page.getByText(proposal.title)).not.toBeVisible();

  await page.goto(`/t/${team.url}/documents/f/${folder.id}`);

  await expect(page.getByText(report.title)).not.toBeVisible();
  await expect(page.locator(`[data-folder-id="${reportsFolder.id}"]`)).not.toBeVisible();
});

test('[TEAMS]: create folder button is visible on templates page', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await expect(page.getByTestId('folder-create-button')).toBeVisible();
});

test('[TEAMS]: can create a template folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByTestId('folder-create-button').click();
  await expect(page.getByRole('dialog', { name: 'Create New folder' })).toBeVisible();

  await page.getByLabel('Folder name').fill('Team template folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('Team template folder')).toBeVisible();

  await page.goto(`/t/${team.url}/templates`);
  await expect(page.locator(`[data-folder-name="Team template folder"]`)).toBeVisible();
});

test('[TEAMS]: can create a template subfolder inside a template folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const folder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Client Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates/f/${folder.id}`,
  });

  await expect(page.getByText('Team Client Templates')).toBeVisible();

  await page.getByTestId('folder-create-button').click();
  await expect(page.getByRole('dialog', { name: 'Create New folder' })).toBeVisible();

  await page.getByLabel('Folder name').fill('Team Contract Templates');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('Team Contract Templates')).toBeVisible();
});

test('[TEAMS]: can create a template inside a template folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const folder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Client Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates/f/${folder.id}`,
  });

  await expect(page.getByText('Team Client Templates')).toBeVisible();

  await page.getByRole('button', { name: 'Template (Legacy)' }).click();

  await page.getByText('Upload Template Document').click();

  await page.locator('input[type="file"]').nth(0).waitFor({ state: 'attached' });

  await page
    .locator('input[type="file"]')
    .nth(0)
    .setInputFiles(path.join(__dirname, '../../../assets/documenso-supporter-pledge.pdf'));

  await page.waitForTimeout(3000);

  // Expect redirect.
  await expectTextToBeVisible(page, 'documenso-supporter-pledge.pdf');

  // Return to folder and verify file is visible.
  await page.goto(`/t/${team.url}/templates/f/${folder.id}`);
  await expectTextToBeVisible(page, 'documenso-supporter-pledge.pdf');
});

test('[TEAMS]: can pin a template folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Pin' }).click();

  await page.reload();

  await expect(page.locator('svg.text-documenso.h-3.w-3')).toBeVisible();
});

test('[TEAMS]: can unpin a template folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      pinned: true,
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Unpin' }).click();

  await page.reload();
  await page.waitForTimeout(1000);

  await expect(page.locator('svg.text-documenso.h-3.w-3')).not.toBeVisible();
});

test('[TEAMS]: can rename a template folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await page.getByLabel('Name').fill('Updated Team Template Folder');
  await page.getByRole('button', { name: 'Update' }).click();

  await expect(page.getByText('Updated Team Template Folder')).toBeVisible();
});

test('[TEAMS]: template folder visibility is not visible to team member', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('menuitem', { name: 'Visibility' })).not.toBeVisible();
});

test('[TEAMS]: template folder can be moved to another template folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const folder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Client Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByTestId('folder-card-more-button').nth(0).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();

  await page.getByRole('button', { name: 'Team Client Templates' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);

  await page.goto(`/t/${team.url}/templates/f/${folder.id}`);

  await expect(page.getByText('Team Contract Templates')).toBeVisible();
});

test('[TEAMS]: template folder can be deleted', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const folder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Proposal Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  const template = await seedBlankTemplate(teamOwner, team.id, {
    createTemplateOptions: {
      title: 'Team Proposal Template 1',
      folderId: folder.id,
    },
  });

  const subfolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Report Templates',
      parentId: folder.id,
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  const reportTemplate = await seedBlankTemplate(teamOwner, team.id, {
    createTemplateOptions: {
      title: 'Team Report Template 1',
      folderId: subfolder.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  await page.getByRole('textbox').fill(`delete ${folder.name}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.goto(`/t/${team.url}/templates`);

  await page.waitForTimeout(1000);

  // !: This is no longer the case, when deleting a folder its contents will be moved to the root folder.
  // await expect(page.locator(`[data-folder-id="${folder.id}"]`)).not.toBeVisible();
  // await expect(page.getByText(template.title)).not.toBeVisible();

  await page.goto(`/t/${team.url}/templates/f/${folder.id}`);

  await expect(page.getByText(reportTemplate.title)).not.toBeVisible();
  await expect(page.locator(`[data-folder-id="${subfolder.id}"]`)).not.toBeVisible();
});

test('[TEAMS]: can navigate between template folders', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const parentFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Client Templates',
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  const subfolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Contract Templates',
      parentId: parentFolder.id,
      type: FolderType.TEMPLATE,
      teamId: team.id,
    },
  });

  await seedBlankTemplate(teamOwner, team.id, {
    createTemplateOptions: {
      title: 'Team Contract Template 1',
      folderId: subfolder.id,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByText('Team Client Templates').click();
  await expect(page.getByText('Team Contract Templates')).toBeVisible();

  await page.getByText('Team Contract Templates').click();
  await expect(page.getByText('Team Contract Template 1')).toBeVisible();

  await page.getByRole('link', { name: parentFolder.name }).click();
  await expect(page.getByText('Team Contract Templates')).toBeVisible();

  await page.getByRole('link', { name: subfolder.name }).click();
  await expect(page.getByText('Team Contract Template 1')).toBeVisible();
});

test('[TEAMS]: folder visibility is properly applied based on team member roles', async ({
  page,
}) => {
  const { team, teamOwner } = await seedTeamDocuments();

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

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
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
  const { team, teamOwner } = await seedTeamDocuments();

  const teamSettingsId = await prisma.teamGlobalSettings.findFirstOrThrow({
    where: {
      team: {
        id: team.id,
      },
    },
  });

  await prisma.teamGlobalSettings.update({
    where: {
      id: teamSettingsId.id,
    },
    data: {
      documentVisibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByTestId('folder-create-button').click();
  await page.getByLabel('Name').fill('Admin Only Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Admin Only Folder')).toBeVisible();

  await page.goto(`/t/${team.url}/documents/`);

  await page.getByTestId('folder-card-more-button').click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('combobox', { name: 'Visibility' })).toHaveText('Admins only');

  await prisma.teamGlobalSettings.update({
    where: { id: teamSettingsId.id },
    data: { documentVisibility: DocumentVisibility.MANAGER_AND_ABOVE },
  });

  await page.reload();

  await page.getByTestId('folder-create-button').click();
  await page.getByLabel('Name').fill('Manager and above Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Manager and above Folder')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);

  await page.getByTestId('folder-card-more-button').nth(0).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('combobox', { name: 'Visibility' })).toHaveText('Managers and above');

  await prisma.teamGlobalSettings.update({
    where: { id: teamSettingsId.id },
    data: { documentVisibility: DocumentVisibility.EVERYONE },
  });

  await page.reload();

  await page.getByTestId('folder-create-button').click();
  await page.getByLabel('Name').fill('Everyone Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Everyone Folder')).toBeVisible();

  await page.goto(`/t/${team.url}/documents/`);

  await page.getByTestId('folder-card-more-button').nth(0).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  await expect(page.getByRole('combobox', { name: 'Visibility' })).toHaveText('Everyone');
});

test('[TEAMS]: documents inherit folder visibility', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamSettingsId = await prisma.teamGlobalSettings.findFirstOrThrow({
    where: {
      team: {
        id: team.id,
      },
    },
  });

  await prisma.teamGlobalSettings.update({
    where: {
      id: teamSettingsId.id,
    },
    data: {
      documentVisibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByTestId('folder-create-button').click();
  await page.getByLabel('Name').fill('Admin Only Folder');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Admin Only Folder')).toBeVisible();

  await page.getByText('Admin Only Folder').click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/f/.+`));

  // Upload document.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Document (Legacy)' }).click(),
  ]);

  await fileChooser.setFiles(
    path.join(__dirname, '../../../assets/documenso-supporter-pledge.pdf'),
  );

  await page.waitForTimeout(3000);

  await expectTextToBeVisible(page, 'documenso-supporter-pledge.pdf');

  await expect(page.getByRole('combobox').filter({ hasText: 'Admins only' })).toBeVisible();
});

test('[TEAMS]: documents are properly organized within folders', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const folder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Team Folder',
      teamId: team.id,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Folder Document',
      folderId: folder.id,
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Folder Document')).not.toBeVisible();

  await page.getByText('Team Folder').click();
  await page.waitForTimeout(1000);

  await expect(page.getByText('Folder Document')).toBeVisible();
});

test('[TEAMS]: team member can move documents to everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamMember = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member',
    role: TeamMemberRole.MEMBER,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Admin Document',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Manager Document',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Everyone Document',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).not.toBeVisible();
  await expect(page.getByText('Manager Folder')).not.toBeVisible();
  await expect(page.getByText('Everyone Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Admin Document')).not.toBeVisible();
  await expect(page.getByText('[TEST] Manager Document')).not.toBeVisible();
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  const everyoneDocRow = page.getByRole('row', { name: /\[TEST\] Everyone Document/ });
  await everyoneDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move' }).click();

  await expect(page.getByRole('button', { name: 'Everyone Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Everyone Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(3000);
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(3000);

  await expect(page.getByText('[TEST] Everyone Document')).not.toBeVisible();
});

test('[TEAMS]: team manager can move manager document to manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamManager = await seedTeamMember({
    teamId: team.id,
    name: 'Team Manager',
    role: TeamMemberRole.MANAGER,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Manager Document',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await apiSignin({
    page,
    email: teamManager.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  const managerDocRow = page.getByRole('row', { name: /\[TEST\] Manager Document/ });
  await managerDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Manager Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Manager Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);

  await expect(page.getByText('[TEST] Manager Document')).not.toBeVisible();
});

test('[TEAMS]: team manager can move manager document to everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamManager = await seedTeamMember({
    teamId: team.id,
    name: 'Team Manager',
    role: TeamMemberRole.MANAGER,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Manager Document',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await apiSignin({
    page,
    email: teamManager.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Everyone Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  const managerDocRow = page.getByRole('row', { name: /\[TEST\] Manager Document/ });
  await managerDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Everyone Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Everyone Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);

  await expect(page.getByText('[TEST] Manager Document')).not.toBeVisible();
});

test('[TEAMS]: team manager can move everyone document to manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamManager = await seedTeamMember({
    teamId: team.id,
    name: 'Team Manager',
    role: TeamMemberRole.MANAGER,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Everyone Document',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamManager.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  const everyoneDocRow = page.getByRole('row', { name: /\[TEST\] Everyone Document/ });
  await everyoneDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Manager Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Manager Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);

  await expect(page.getByText('[TEST] Everyone Document')).not.toBeVisible();
});

test('[TEAMS]: team admin can move admin document to admin folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Admin Document',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  const adminDocRow = page.getByRole('row', { name: /\[TEST\] Admin Document/ });
  await adminDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Admin Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Admin Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team admin can move admin document to manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Admin Document',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  const adminDocRow = page.getByRole('row', { name: /\[TEST\] Admin Document/ });
  await adminDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Manager Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Manager Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team admin can move admin document to everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Admin Document',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Everyone Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  const adminDocRow = page.getByRole('row', { name: /\[TEST\] Admin Document/ });
  await adminDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Everyone Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Everyone Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team admin can move manager document to admin folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Manager Document',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  const managerDocRow = page.getByRole('row', { name: /\[TEST\] Manager Document/ });
  await managerDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click({ force: true });

  await expect(page.getByRole('button', { name: 'Admin Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Admin Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).not.toBeVisible();
});

test('[TEAMS]: team admin can move manager document to manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Manager Document',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  const managerDocRow = page.getByRole('row', { name: /\[TEST\] Manager Document/ });
  await managerDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click({ force: true });

  await expect(page.getByRole('button', { name: 'Manager Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Manager Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).not.toBeVisible();
});

test('[TEAMS]: team admin can move manager document to everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Manager Document',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Everyone Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  const managerDocRow = page.getByRole('row', { name: /\[TEST\] Manager Document/ });
  await managerDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click({ force: true });

  await expect(page.getByRole('button', { name: 'Everyone Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Everyone Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).not.toBeVisible();
});

test('[TEAMS]: team admin can move everyone document to admin folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Everyone Document',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  const everyoneDocRow = page.getByRole('row', { name: /\[TEST\] Everyone Document/ });
  await everyoneDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Admin Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Admin Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).not.toBeVisible();
});

test('[TEAMS]: team admin can move everyone document to manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Everyone Document',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  const everyoneDocRow = page.getByRole('row', { name: /\[TEST\] Everyone Document/ });
  await everyoneDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Manager Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Manager Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).not.toBeVisible();
});

test('[TEAMS]: team admin can move everyone document to everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Everyone Document',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Everyone Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  const everyoneDocRow = page.getByRole('row', { name: /\[TEST\] Everyone Document/ });
  await everyoneDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Everyone Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Everyone Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can move admin document to admin folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Admin Document',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  const adminDocRow = page.getByRole('row', { name: /\[TEST\] Admin Document/ });
  await adminDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Admin Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Admin Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can move admin document to manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Admin Document',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  const adminDocRow = page.getByRole('row', { name: /\[TEST\] Admin Document/ });
  await adminDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Manager Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Manager Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can move admin document to everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Admin Document',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Everyone Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  const adminDocRow = page.getByRole('row', { name: /\[TEST\] Admin Document/ });
  await adminDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Everyone Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Everyone Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can move manager document to admin folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Manager Document',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  const managerDocRow = page.getByRole('row', { name: /\[TEST\] Manager Document/ });
  await managerDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Admin Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Admin Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can move manager document to manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Manager Document',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  const managerDocRow = page.getByRole('row', { name: /\[TEST\] Manager Document/ });
  await managerDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Manager Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Manager Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can move manager document to everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Manager Document',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Everyone Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  const managerDocRow = page.getByRole('row', { name: /\[TEST\] Manager Document/ });
  await managerDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Everyone Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Everyone Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Manager Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can move everyone document to admin folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Everyone Document',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  const everyoneDocRow = page.getByRole('row', { name: /\[TEST\] Everyone Document/ });
  await everyoneDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Admin Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Admin Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can move everyone document to manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Everyone Document',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  const everyoneDocRow = page.getByRole('row', { name: /\[TEST\] Everyone Document/ });
  await everyoneDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Manager Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Manager Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can move everyone document to everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      type: FolderType.DOCUMENT,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: '[TEST] Everyone Document',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Everyone Folder')).toBeVisible();
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  const everyoneDocRow = page.getByRole('row', { name: /\[TEST\] Everyone Document/ });
  await everyoneDocRow.getByTestId('document-table-action-btn').click();
  await page.getByRole('menuitem', { name: 'Move to Folder' }).click();

  await expect(page.getByRole('button', { name: 'Everyone Folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Everyone Folder' }).click();
  await page.getByRole('button', { name: 'Move' }).click();

  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).toBeVisible();

  await page.goto(`/t/${team.url}/documents`);
  await page.waitForTimeout(1000);
  await expect(page.getByText('[TEST] Everyone Document')).not.toBeVisible();
});

test('[TEAMS]: team member cannot see admin folder in folder list', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamMember = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member',
    role: TeamMemberRole.MEMBER,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).not.toBeVisible();
});

test('[TEAMS]: team member can access admin folder via URL and see everyone documents', async ({
  page,
}) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamMember = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member',
    role: TeamMemberRole.MEMBER,
  });

  const adminFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Everyone Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Manager Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Admin Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents/f/${adminFolder.id}`,
  });

  await expect(page.getByRole('button', { name: 'Admin Only Folder' })).not.toBeVisible();
  await expect(page.getByText('Admin Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Admin Folder - Manager Document')).not.toBeVisible();
  await expect(page.getByText('Admin Folder - Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team member cannot see manager folder in folder list', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamMember = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member',
    role: TeamMemberRole.MEMBER,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Manager Folder')).not.toBeVisible();
});

test('[TEAMS]: team member can access manager folder via URL and see everyone documents', async ({
  page,
}) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamMember = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member',
    role: TeamMemberRole.MEMBER,
  });

  const managerFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Everyone Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Manager Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Admin Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents/f/${managerFolder.id}`,
  });

  await expect(page.getByRole('button', { name: 'Manager Folder' })).not.toBeVisible();
  await expect(page.getByText('Manager Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Manager Folder - Manager Document')).not.toBeVisible();
  await expect(page.getByText('Manager Folder - Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team member can see everyone folders', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamMember = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member',
    role: TeamMemberRole.MEMBER,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).not.toBeVisible();
  await expect(page.getByText('Manager Folder')).not.toBeVisible();
  await expect(page.getByText('Everyone Folder')).toBeVisible();
});

test('[TEAMS]: team member can only see everyone documents in everyone folder', async ({
  page,
}) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamMember = await seedTeamMember({
    teamId: team.id,
    name: 'Team Member',
    role: TeamMemberRole.MEMBER,
  });

  const everyoneFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents/f/${everyoneFolder.id}`,
  });

  await expect(page.getByText('Everyone Document')).toBeVisible();
  await expect(page.getByText('Manager Document')).not.toBeVisible();
  await expect(page.getByText('Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team manager can see manager and everyone folders in folder list', async ({
  page,
}) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamManager = await seedTeamMember({
    teamId: team.id,
    name: 'Team Manager',
    role: TeamMemberRole.MANAGER,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamManager.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).not.toBeVisible();
  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('Everyone Folder')).toBeVisible();
});

test('[TEAMS]: team manager can see manager and everyone documents in manager folder', async ({
  page,
}) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamManager = await seedTeamMember({
    teamId: team.id,
    name: 'Team Manager',
    role: TeamMemberRole.MANAGER,
  });

  const managerFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Everyone Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Manager Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Admin Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamManager.email,
    redirectPath: `/t/${team.url}/documents/f/${managerFolder.id}`,
  });

  await expect(
    page.getByTestId('folder-grid-breadcrumbs').getByRole('link', { name: 'Manager Folder' }),
  ).toBeVisible();

  await expect(page.getByText('Manager Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Manager Folder - Manager Document')).toBeVisible();
  await expect(page.getByText('Manager Folder - Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team manager can see manager and everyone documents in everyone folder', async ({
  page,
}) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamManager = await seedTeamMember({
    teamId: team.id,
    name: 'Team Manager',
    role: TeamMemberRole.MANAGER,
  });

  const everyoneFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Folder - Everyone Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Folder - Manager Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Folder - Admin Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamManager.email,
    redirectPath: `/t/${team.url}/documents/f/${everyoneFolder.id}`,
  });

  await expect(
    page.getByTestId('folder-grid-breadcrumbs').getByRole('link', { name: 'Everyone Folder' }),
  ).toBeVisible();

  await expect(page.getByText('Everyone Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Everyone Folder - Manager Document')).toBeVisible();
  await expect(page.getByText('Everyone Folder - Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team manager can access admin folder via URL and see manager and everyone documents', async ({
  page,
}) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamManager = await seedTeamMember({
    teamId: team.id,
    name: 'Team Manager',
    role: TeamMemberRole.MANAGER,
  });

  const adminFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Everyone Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Manager Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Admin Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamManager.email,
    redirectPath: `/t/${team.url}/documents/f/${adminFolder.id}`,
  });

  await expect(page.getByRole('button', { name: 'Admin Only Folder' })).not.toBeVisible();
  await expect(page.getByText('Admin Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Admin Folder - Manager Document')).toBeVisible();
  await expect(page.getByText('Admin Folder - Admin Document')).not.toBeVisible();
});

test('[TEAMS]: team owner can see all folders in folder list', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).toBeVisible();
  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('Everyone Folder')).toBeVisible();
});

test('[TEAMS]: team owner can see all documents in admin folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const adminFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Everyone Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Manager Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Admin Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents/f/${adminFolder.id}`,
  });

  await expect(
    page.getByTestId('folder-grid-breadcrumbs').getByRole('link', { name: 'Admin Only Folder' }),
  ).toBeVisible();

  await expect(page.getByText('Admin Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Admin Folder - Manager Document')).toBeVisible();
  await expect(page.getByText('Admin Folder - Admin Document')).toBeVisible();
});

test('[TEAMS]: team owner can see all documents in manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const managerFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Everyone Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Manager Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Admin Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents/f/${managerFolder.id}`,
  });

  await expect(
    page.getByTestId('folder-grid-breadcrumbs').getByRole('link', { name: 'Manager Folder' }),
  ).toBeVisible();
  await expect(page.getByText('Manager Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Manager Folder - Manager Document')).toBeVisible();
  await expect(page.getByText('Manager Folder - Admin Document')).toBeVisible();
});

test('[TEAMS]: team owner can see all documents in everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const everyoneFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Folder - Everyone Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Folder - Manager Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Folder - Admin Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents/f/${everyoneFolder.id}`,
  });

  await expect(
    page.getByTestId('folder-grid-breadcrumbs').getByRole('link', { name: 'Everyone Folder' }),
  ).toBeVisible();
  await expect(page.getByText('Everyone Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Everyone Folder - Manager Document')).toBeVisible();
  await expect(page.getByText('Everyone Folder - Admin Document')).toBeVisible();
});

test('[TEAMS]: team admin can see all folders in folder list', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Admin Only Folder')).toBeVisible();
  await expect(page.getByText('Manager Folder')).toBeVisible();
  await expect(page.getByText('Everyone Folder')).toBeVisible();
});

test('[TEAMS]: team admin can see all documents in admin folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  const adminFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Admin Only Folder',
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Everyone Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Manager Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Admin Folder - Admin Document',
      folderId: adminFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents/f/${adminFolder.id}`,
  });

  await expect(
    page.getByTestId('folder-grid-breadcrumbs').getByRole('link', { name: 'Admin Only Folder' }),
  ).toBeVisible();

  await expect(page.getByText('Admin Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Admin Folder - Manager Document')).toBeVisible();
  await expect(page.getByText('Admin Folder - Admin Document')).toBeVisible();
});

test('[TEAMS]: team admin can see all documents in manager folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  const managerFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Manager Folder',
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Everyone Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Manager Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Manager Folder - Admin Document',
      folderId: managerFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents/f/${managerFolder.id}`,
  });

  await expect(
    page.getByTestId('folder-grid-breadcrumbs').getByRole('link', { name: 'Manager Folder' }),
  ).toBeVisible();
  await expect(page.getByText('Manager Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Manager Folder - Manager Document')).toBeVisible();
  await expect(page.getByText('Manager Folder - Admin Document')).toBeVisible();
});

test('[TEAMS]: team admin can see all documents in everyone folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const teamAdmin = await seedTeamMember({
    teamId: team.id,
    name: 'Team Admin',
    role: TeamMemberRole.ADMIN,
  });

  const everyoneFolder = await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Everyone Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Folder - Everyone Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Folder - Manager Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.MANAGER_AND_ABOVE,
    },
  });

  await seedBlankDocument(teamOwner, team.id, {
    createDocumentOptions: {
      title: 'Everyone Folder - Admin Document',
      folderId: everyoneFolder.id,
      teamId: team.id,
      visibility: DocumentVisibility.ADMIN,
    },
  });

  await apiSignin({
    page,
    email: teamAdmin.email,
    redirectPath: `/t/${team.url}/documents/f/${everyoneFolder.id}`,
  });

  await expect(
    page.getByTestId('folder-grid-breadcrumbs').getByRole('link', { name: 'Everyone Folder' }),
  ).toBeVisible();
  await expect(page.getByText('Everyone Folder - Everyone Document')).toBeVisible();
  await expect(page.getByText('Everyone Folder - Manager Document')).toBeVisible();
  await expect(page.getByText('Everyone Folder - Admin Document')).toBeVisible();
});
