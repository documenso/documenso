import { expect, test } from '@playwright/test';

import { seedTeam } from '@documenso/prisma/seed/teams';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[TEAMS]: update the default document visibility in the team global settings', async ({
  page,
}) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  await apiSignin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/t/${team.url}/settings/preferences`,
  });

  // !: Brittle selector
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Admin' }).click();
  await page.getByRole('button', { name: 'Update' }).first().click();

  const toast = page.locator('li[role="status"][data-state="open"]').first();
  await expect(toast).toBeVisible();
  await expect(toast.getByText('Document preferences updated', { exact: true })).toBeVisible();
});

test('[TEAMS]: update the sender details in the team global settings', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  await apiSignin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/t/${team.url}/settings/preferences`,
  });

  const checkbox = page.getByLabel('Send on Behalf of Team');
  await checkbox.check();

  await expect(checkbox).toBeChecked();

  await page.getByRole('button', { name: 'Update' }).first().click();

  const toast = page.locator('li[role="status"][data-state="open"]').first();
  await expect(toast).toBeVisible();
  await expect(toast.getByText('Document preferences updated', { exact: true })).toBeVisible();

  await expect(checkbox).toBeChecked();
});
