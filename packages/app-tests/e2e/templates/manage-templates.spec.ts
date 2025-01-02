import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedTemplate } from '@documenso/prisma/seed/templates';

import { apiSignin } from '../fixtures/authentication';

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

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: '/templates',
  });

  // Only should only see their personal template.
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 1 result');

  // Owner should see both team templates.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/templates`);
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 2 results');
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

  await apiSignin({
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
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/templates`);

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

    await page.reload();
  }
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

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: '/templates',
  });

  // Duplicate personal template.
  await page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Template duplicated').first()).toBeVisible();
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 2 results');

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/templates`);

  // Duplicate team template.
  await page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Template duplicated').first()).toBeVisible();
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 2 results');
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

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: '/templates',
  });

  // Use personal template.
  await page.getByRole('button', { name: 'Use Template' }).click();

  // Enter template values.
  await page.getByPlaceholder('recipient.1@documenso.com').click();
  await page.getByPlaceholder('recipient.1@documenso.com').fill(teamMemberUser.email);
  await page.getByPlaceholder('Recipient 1').click();
  await page.getByPlaceholder('Recipient 1').fill('name');

  await page.getByRole('button', { name: 'Create as draft' }).click();
  await page.waitForURL(/documents/);
  await page.getByRole('main').getByRole('link', { name: 'Documents' }).click();
  await page.waitForURL('/documents');
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 1 result');

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/templates`);
  await page.waitForTimeout(1000);

  // Use team template.
  await page.getByRole('button', { name: 'Use Template' }).click();

  // Enter template values.
  await page.getByPlaceholder('recipient.1@documenso.com').click();
  await page.getByPlaceholder('recipient.1@documenso.com').fill(teamMemberUser.email);
  await page.getByPlaceholder('Recipient 1').click();
  await page.getByPlaceholder('Recipient 1').fill('name');

  await page.getByRole('button', { name: 'Create as draft' }).click();
  await page.waitForURL(/\/t\/.+\/documents/);
  await page.getByRole('main').getByRole('link', { name: 'Documents' }).click();
  await page.waitForURL(`/t/${team.url}/documents`);
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 1 result');
});
