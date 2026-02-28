import { expect, test } from '@playwright/test';
import { TeamMemberRole, TemplateType } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedTemplate } from '@documenso/prisma/seed/templates';

import { apiSignin } from '../fixtures/authentication';
import { openDropdownMenu } from '../fixtures/generic';

test('[TEMPLATES]: view templates', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  const teamMemberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  // Should be visible to team members.
  await seedTemplate({
    title: 'Team template 1',
    userId: owner.id,
    teamId: team.id,
  });

  // Should be visible to team members.
  await seedTemplate({
    title: 'Team template 2',
    userId: teamMemberUser.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  // Owner should see both team templates.
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 2 results');
});

test('[TEMPLATES]: supports search and multi-type filtering', async ({ page }) => {
  const { team, owner } = await seedTeam({
    createTeamMembers: 1,
  });

  const publicTemplate = await seedTemplate({
    title: 'Public Team Template',
    userId: owner.id,
    teamId: team.id,
  });

  const privateTemplate = await seedTemplate({
    title: 'Private Team Template',
    userId: owner.id,
    teamId: team.id,
  });

  await prisma.envelope.update({
    where: {
      id: publicTemplate.id,
    },
    data: {
      templateType: TemplateType.PUBLIC,
    },
  });

  await prisma.envelope.update({
    where: {
      id: privateTemplate.id,
    },
    data: {
      templateType: TemplateType.PRIVATE,
    },
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates?query=Public&type=PUBLIC`,
  });

  await expect(page.getByRole('link', { name: 'Public Team Template' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Private Team Template' })).not.toBeVisible();

  await page.goto(`/t/${team.url}/templates?type=PUBLIC,PRIVATE`);

  await expect(page.getByRole('link', { name: 'Public Team Template' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Private Team Template' })).toBeVisible();
});

test('[TEMPLATES]: delete template', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  const teamMemberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  // Should be visible to team members.
  await seedTemplate({
    title: 'Team template 1',
    userId: owner.id,
    teamId: team.id,
  });

  // Should be visible to team members.
  await seedTemplate({
    title: 'Team template 2',
    userId: teamMemberUser.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  for (const template of ['Team template 1', 'Team template 2']) {
    const actionBtn = page
      .getByRole('row', { name: template })
      .getByRole('cell', { name: 'Use Template' })
      .getByRole('button')
      .nth(1);
    await openDropdownMenu(page, actionBtn);

    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Template deleted').first()).toBeVisible();

    await page.reload();
  }
});

test('[TEMPLATES]: duplicate template', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  const teamMemberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  // Should be visible to team members.
  await seedTemplate({
    title: 'Team template 1',
    userId: teamMemberUser.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  // Duplicate team template.
  const actionBtn = page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1);
  await openDropdownMenu(page, actionBtn);
  await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Template duplicated').first()).toBeVisible();
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 2 results');
});

test('[TEMPLATES]: use template', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  const teamMemberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  // Should be visible to team members.
  await seedTemplate({
    title: 'Team template 1',
    userId: teamMemberUser.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  // Use team template.
  await page.getByRole('button', { name: 'Use Template' }).click();

  // Enter template values.
  // Get input with Email label placeholder.
  await page.getByLabel('Email').click();
  await page.getByLabel('Email').fill(teamMemberUser.email);
  await page.getByLabel('Name').click();
  await page.getByLabel('Name').fill('name');

  await page.getByRole('button', { name: 'Create as draft' }).click();
  await page.waitForURL(/\/t\/.+\/documents/);
  await page.getByRole('main').getByRole('link', { name: 'Documents' }).click();
  await page.waitForURL(`/t/${team.url}/documents`);
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 1 result');
});
