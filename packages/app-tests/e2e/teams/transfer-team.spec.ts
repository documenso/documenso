import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { seedTeam, seedTeamTransfer } from '@documenso/prisma/seed/teams';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[TEAMS]: initiate and cancel team transfer', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const teamMember = team.members[1];

  await apiSignin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/t/${team.url}/settings`,
  });

  await page.getByRole('button', { name: 'Transfer team' }).click();

  await page.getByRole('combobox').click();
  await page.getByLabel(teamMember.user.name ?? '').click();
  await page.getByLabel('Confirm by typing transfer').click();
  await page.getByLabel('Confirm by typing transfer').fill('transfer');
  await page.getByRole('button', { name: 'Transfer' }).click();

  await expect(page.locator('[id*="form-item-message"]').first()).toContainText(
    `You must enter 'transfer ${team.name}' to proceed`,
  );

  await page.getByLabel('Confirm by typing transfer').click();
  await page.getByLabel('Confirm by typing transfer').fill(`transfer ${team.name}`);
  await page.getByRole('button', { name: 'Transfer' }).click();

  await expect(page.getByRole('heading', { name: 'Team transfer in progress' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('status').first()).toContainText(
    'The team transfer invitation has been successfully deleted.',
  );
});

/**
 * Current skipped until we disable billing during tests.
 */
test.skip('[TEAMS]: accept team transfer', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const newOwnerMember = team.members[1];

  const teamTransferRequest = await seedTeamTransfer({
    teamId: team.id,
    newOwnerUserId: newOwnerMember.userId,
  });

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/team/verify/transfer/${teamTransferRequest.token}`);
  await expect(page.getByRole('heading')).toContainText('Team ownership transferred!');
});
