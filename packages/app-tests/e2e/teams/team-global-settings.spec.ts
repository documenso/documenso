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
    redirectPath: `/t/${team.url}/settings/documents`,
  });

  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Admin' }).click();
  await page.getByRole('button', { name: 'Update profile' }).click();

  const toast = page.locator('li[role="status"][data-state="open"]');
  await expect(toast).toBeVisible();
  await expect(toast.getByText('Global Team Settings Updated')).toBeVisible();
  await expect(
    toast.getByText('Your global team document settings has been updated successfully.'),
  ).toBeVisible();
});

test('[TEAMS]: update the sender details in the team global settings', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  await apiSignin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/t/${team.url}/settings/documents`,
  });

  const checkbox = page.getByLabel('Include Sender Details');
  await checkbox.check();

  await expect(checkbox).toBeChecked();

  await page.getByRole('button', { name: 'Update profile' }).click();

  const toast = page.locator('li[role="status"][data-state="open"]');
  await expect(toast).toBeVisible();
  await expect(toast.getByText('Global Team Settings Updated')).toBeVisible();
  await expect(
    toast.getByText('Your global team document settings has been updated successfully.'),
  ).toBeVisible();

  await expect(checkbox).toBeChecked();
});
