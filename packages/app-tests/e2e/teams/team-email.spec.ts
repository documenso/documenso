import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedTeamEmailVerification } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';
import { openDropdownMenu } from '../fixtures/generic';

test('[TEAMS]: send team email request', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
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
    page.getByRole('status').filter({ hasText: 'We have sent a confirmation email for verification.' }).first(),
  ).toBeVisible();
});

test('[TEAMS]: accept team email request', async ({ page }) => {
  const { team } = await seedUser();

  const teamEmailVerification = await seedTeamEmailVerification({
    email: `team-email-verification--${team.url}@test.documenso.com`,
    teamId: team.id,
  });

  const getTeamEmail = async () => prisma.teamEmail.findUnique({ where: { teamId: team.id } });

  expect(await getTeamEmail()).toBeNull();

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/team/verify/email/${teamEmailVerification.token}`);

  // Visiting the page (GET) must not verify the team email. An automated email link
  // scanner or prefetcher must not be able to complete the verification.
  await expect(page.getByRole('heading', { name: 'Verify team email' })).toBeVisible();
  expect(await getTeamEmail()).toBeNull();

  await page.getByRole('button', { name: 'Verify email' }).click();

  await expect(page.getByRole('heading', { name: 'Team email verified!' })).toBeVisible();

  expect(await getTeamEmail()).not.toBeNull();
});

test('[TEAMS]: team email verification link is invalid once completed', async ({ page }) => {
  const { team } = await seedUser();

  const teamEmailVerification = await seedTeamEmailVerification({
    email: `team-email-verification--${team.url}@test.documenso.com`,
    teamId: team.id,
  });

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/team/verify/email/${teamEmailVerification.token}`);
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByRole('heading', { name: 'Team email verified!' })).toBeVisible();

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/team/verify/email/${teamEmailVerification.token}`);
  await expect(page.getByRole('heading', { name: 'Team email already verified!' })).toBeVisible();
});

test('[TEAMS]: delete team email', async ({ page }) => {
  const { user, team } = await seedUser({
    setTeamEmailAsOwner: true,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings`,
  });

  const settingsBtn = page.locator('section div').filter({ hasText: 'Team email' }).getByRole('button');
  await openDropdownMenu(page, settingsBtn);

  await expect(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Remove' }).click();

  await expect(page.getByText('Team email has been removed').first()).toBeVisible();
});

test('[TEAMS]: team email owner removes access', async ({ page }) => {
  const teamEmailOwner = await seedUser();

  const { user: secondUser } = await seedUser({
    teamEmail: teamEmailOwner.user.email,
  });

  await apiSignin({
    page,
    email: teamEmailOwner.user.email,
    redirectPath: `/settings/profile`,
  });

  await page.getByRole('button', { name: 'Revoke access' }).click();
  await page.getByRole('button', { name: 'Revoke' }).click();

  await expect(page.getByText('You have successfully revoked').first()).toBeVisible();
});
