import { expect, test } from '@playwright/test';

import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { seedTeam, seedTeamEmailVerification, unseedTeam } from '@documenso/prisma/seed/teams';
import { seedUser, unseedUser } from '@documenso/prisma/seed/users';

import { manualLogin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[TEAMS]: send team email request', async ({ page }) => {
  const team = await seedTeam();

  await manualLogin({
    page,
    email: team.owner.email,
    password: 'password',
    redirectPath: `/t/${team.url}/settings`,
  });

  await page.getByRole('button', { name: 'Add email' }).click();
  await page.getByPlaceholder('eg. Legal').click();
  await page.getByPlaceholder('eg. Legal').fill('test@test.documenso.com');
  await page.getByPlaceholder('example@example.com').click();
  await page.getByPlaceholder('example@example.com').fill('test@test.documenso.com');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'We have sent a confirmation email for verification.' })
      .first(),
  ).toBeVisible();

  await unseedTeam(team.url);
});

test('[TEAMS]: accept team email request', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const teamEmailVerification = await seedTeamEmailVerification({
    email: 'team-email-verification@test.documenso.com',
    teamId: team.id,
  });

  await page.goto(`${WEBAPP_BASE_URL}/team/verify/email/${teamEmailVerification.token}`);
  await expect(page.getByRole('heading')).toContainText('Team email verified!');

  await unseedTeam(team.url);
});

test('[TEAMS]: delete team email', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
    createTeamEmail: true,
  });

  await manualLogin({
    page,
    email: team.owner.email,
    redirectPath: `/t/${team.url}/settings`,
  });

  await page.locator('section div').filter({ hasText: 'Team email' }).getByRole('button').click();

  await page.getByRole('menuitem', { name: 'Remove' }).click();

  await expect(page.getByText('Team email has been removed').first()).toBeVisible();

  await unseedTeam(team.url);
});

test('[TEAMS]: team email owner removes access', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
    createTeamEmail: true,
  });

  if (!team.teamEmail) {
    throw new Error('Not possible');
  }

  const teamEmailOwner = await seedUser({
    email: team.teamEmail.email,
  });

  await manualLogin({
    page,
    email: teamEmailOwner.email,
    redirectPath: `/settings/teams`,
  });

  await page.getByRole('button', { name: 'Revoke access' }).click();
  await page.getByRole('button', { name: 'Revoke' }).click();

  await expect(page.getByText('You have successfully revoked').first()).toBeVisible();

  await unseedTeam(team.url);
  await unseedUser(teamEmailOwner.id);
});
