import { expect, test } from '@playwright/test';

import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { seedTeam, seedTeamInvite } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[TEAMS]: update team member role', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  await apiSignin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/t/${team.url}/settings/members`,
  });

  const teamMemberToUpdate = team.members[1];

  await page
    .getByRole('row')
    .filter({ hasText: teamMemberToUpdate.user.email })
    .getByRole('button')
    .click();

  await page.getByRole('menuitem', { name: 'Update role' }).click();
  await page.getByRole('combobox').click();
  await page.getByLabel('Manager').click();
  await page.getByRole('button', { name: 'Update' }).click();

  // TODO: Remove me, but i don't care for now
  await page.reload();

  await expect(
    page.getByRole('row').filter({ hasText: teamMemberToUpdate.user.email }).first(),
  ).toContainText('Manager');
});

test('[TEAMS]: accept team invitation without account', async ({ page }) => {
  const team = await seedTeam();

  const teamInvite = await seedTeamInvite({
    email: `team-invite-test-${Date.now()}@test.documenso.com`,
    teamId: team.id,
  });

  await page.goto(`${WEBAPP_BASE_URL}/team/invite/${teamInvite.token}`);
  await expect(page.getByRole('heading')).toContainText('Team invitation');
});

test('[TEAMS]: accept team invitation with account', async ({ page }) => {
  const team = await seedTeam();
  const user = await seedUser();

  const teamInvite = await seedTeamInvite({
    email: user.email,
    teamId: team.id,
  });

  await page.goto(`${WEBAPP_BASE_URL}/team/invite/${teamInvite.token}`);
  await expect(page.getByRole('heading')).toContainText('Invitation accepted!');
});

test('[TEAMS]: member can leave team', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const teamMember = team.members[1];

  await apiSignin({
    page,
    email: teamMember.user.email,
    password: 'password',
    redirectPath: `/settings/teams`,
  });

  await page.getByRole('button', { name: 'Leave' }).click();
  await page.getByRole('button', { name: 'Leave' }).click();

  await expect(page.getByRole('status').first()).toContainText(
    'You have successfully left this team.',
  );
});

test('[TEAMS]: owner cannot leave team', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  await apiSignin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/settings/teams`,
  });

  await expect(page.getByRole('button').getByText('Leave')).toBeDisabled();
});
