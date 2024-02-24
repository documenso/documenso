import { expect, test } from '@playwright/test';

import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { seedTeam, unseedTeam } from '@documenso/prisma/seed/teams';
import { seedTemplate } from '@documenso/prisma/seed/templates';

import { manualLogin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[TEMPLATES]: view templates', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const owner = team.owner;
  const teamMemberUser = team.members[1].user;

  // Should only be visible to the owner in personal templates.
  await seedTemplate({
    title: 'Personal template',
    userId: owner.id,
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

  await manualLogin({
    page,
    email: owner.email,
    redirectPath: '/templates',
  });

  // Owner should see both team templates.
  await page.goto(`${WEBAPP_BASE_URL}/t/${team.url}/templates`);
  await expect(page.getByRole('main')).toContainText('Showing 2 results');

  // Only should only see their personal template.
  await page.goto(`${WEBAPP_BASE_URL}/templates`);
  await expect(page.getByRole('main')).toContainText('Showing 1 result');

  await unseedTeam(team.url);
});

test('[TEMPLATES]: delete template', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const owner = team.owner;
  const teamMemberUser = team.members[1].user;

  // Should only be visible to the owner in personal templates.
  await seedTemplate({
    title: 'Personal template',
    userId: owner.id,
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

  await manualLogin({
    page,
    email: owner.email,
    redirectPath: '/templates',
  });

  // Owner should be able to delete their personal template.
  await page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Template deleted').first()).toBeVisible();

  // Team member should be able to delete all templates.
  await page.goto(`${WEBAPP_BASE_URL}/t/${team.url}/templates`);

  for (const template of ['Team template 1', 'Team template 2']) {
    await page
      .getByRole('row', { name: template })
      .getByRole('cell', { name: 'Use Template' })
      .getByRole('button')
      .nth(1)
      .click();

    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Template deleted').first()).toBeVisible();

    await page.waitForTimeout(1000);
  }

  await unseedTeam(team.url);
});

test('[TEMPLATES]: duplicate template', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const owner = team.owner;
  const teamMemberUser = team.members[1].user;

  // Should only be visible to the owner in personal templates.
  await seedTemplate({
    title: 'Personal template',
    userId: owner.id,
  });

  // Should be visible to team members.
  await seedTemplate({
    title: 'Team template 1',
    userId: teamMemberUser.id,
    teamId: team.id,
  });

  await manualLogin({
    page,
    email: owner.email,
    redirectPath: '/templates',
  });

  // Duplicate personal template.
  await page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Template duplicated').first()).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Showing 2 results');

  await page.goto(`${WEBAPP_BASE_URL}/t/${team.url}/templates`);

  // Duplicate team template.
  await page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Template duplicated').first()).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Showing 2 results');

  await unseedTeam(team.url);
});

test('[TEMPLATES]: use template', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const owner = team.owner;
  const teamMemberUser = team.members[1].user;

  // Should only be visible to the owner in personal templates.
  await seedTemplate({
    title: 'Personal template',
    userId: owner.id,
  });

  // Should be visible to team members.
  await seedTemplate({
    title: 'Team template 1',
    userId: teamMemberUser.id,
    teamId: team.id,
  });

  await manualLogin({
    page,
    email: owner.email,
    redirectPath: '/templates',
  });

  // Use personal template.
  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create Document' }).click();
  await page.waitForURL(/documents/);
  await page.getByRole('main').getByRole('link', { name: 'Documents' }).click();
  await page.waitForURL('/documents');
  await expect(page.getByRole('main')).toContainText('Showing 1 result');

  await page.goto(`${WEBAPP_BASE_URL}/t/${team.url}/templates`);
  await page.waitForTimeout(1000);

  // Use team template.
  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create Document' }).click();
  await page.waitForURL(/\/t\/.+\/documents/);
  await page.getByRole('main').getByRole('link', { name: 'Documents' }).click();
  await page.waitForURL(`/t/${team.url}/documents`);
  await expect(page.getByRole('main')).toContainText('Showing 1 result');

  await unseedTeam(team.url);
});
