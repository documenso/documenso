import { test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[TEAMS]: create team', async ({ page }) => {
  const { user, organisation } = await seedUser();

  test.skip(
    process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED === 'true',
    'Test skipped because billing is enabled.',
  );

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/org/${organisation.url}/settings/teams`,
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
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings`,
  });

  // Delete team.
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByLabel(`Confirm by typing delete ${team.name}`).fill(`delete ${team.name}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  // Check that we have been redirected to the teams page.
  await page.waitForURL(`${NEXT_PUBLIC_WEBAPP_URL()}/settings/organisations`);
});

test('[TEAMS]: update team', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings`,
  });

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
