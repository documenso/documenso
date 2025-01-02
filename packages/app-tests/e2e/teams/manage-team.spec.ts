import { test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[TEAMS]: create team', async ({ page }) => {
  const user = await seedUser();

  test.skip(
    process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED === 'true',
    'Test skipped because billing is enabled.',
  );

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/settings/teams',
  });

  const teamId = `team-${Date.now()}`;

  // Create team.
  await page.getByRole('button', { name: 'Create team' }).click();
  await page.getByLabel('Team Name*').fill(teamId);
  await page.getByTestId('dialog-create-team-button').click();

  await page.getByTestId('dialog-create-team-button').waitFor({ state: 'hidden' });

  // Goto new team settings page.
  await page.getByRole('row').filter({ hasText: teamId }).getByRole('link').nth(1).click();
});

test('[TEAMS]: delete team', async ({ page }) => {
  const team = await seedTeam();

  await apiSignin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/settings`,
  });

  // Delete team.
  await page.getByRole('button', { name: 'Delete team' }).click();
  await page.getByLabel(`Confirm by typing delete ${team.url}`).fill(`delete ${team.url}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  // Check that we have been redirected to the teams page.
  await page.waitForURL(`${NEXT_PUBLIC_WEBAPP_URL()}/settings/teams`);
});

test('[TEAMS]: update team', async ({ page }) => {
  const team = await seedTeam();

  await apiSignin({
    page,
    email: team.owner.email,
  });

  // Navigate to create team page.
  await page.getByTestId('menu-switcher').click();
  await page.getByRole('menuitem', { name: 'Manage teams' }).click();

  // Goto team settings page.
  await page.getByRole('row').filter({ hasText: team.url }).getByRole('link').nth(1).click();

  const updatedTeamId = `team-${Date.now()}`;

  // Update team.
  await page.getByLabel('Team Name*').click();
  await page.getByLabel('Team Name*').clear();
  await page.getByLabel('Team Name*').fill(updatedTeamId);
  await page.getByLabel('Team URL*').click();
  await page.getByLabel('Team URL*').clear();
  await page.getByLabel('Team URL*').fill(updatedTeamId);

  await page.getByRole('button', { name: 'Update team' }).click();

  // Check we have been redirected to the new team URL and the name is updated.
  await page.waitForURL(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${updatedTeamId}/settings`);
});
