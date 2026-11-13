import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';
import { expectTextToBeVisible } from '../fixtures/generic';

test('[TEAMS]: create team', async ({ page }) => {
  const { user, organisation } = await seedUser();

  test.skip(process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED === 'true', 'Test skipped because billing is enabled.');

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/teams`,
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
  const { user, team, organisation } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings`,
  });

  // Delete team.
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByLabel(`Confirm by typing delete ${team.name}`).fill(`delete ${team.name}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  // Your team has been successfully deleted
  await expectTextToBeVisible(page, 'Your team has been successfully deleted');
});

test('[TEAMS]: delete team without transferring documents', async ({ page }) => {
  const { user, team, organisation } = await seedUser();
  const otherTeam = await seedSiblingTeam(user.id, organisation.id);
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings`,
  });

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByLabel(`Confirm by typing delete ${team.name}`).fill(`delete ${team.name}`);

  const transferSelect = page.getByRole('dialog').getByRole('combobox');

  // Pick a team first: "Don't transfer" has to replace that choice, not only work as the untouched default.
  await transferSelect.click();
  await page.getByRole('option', { name: otherTeam.name }).click();
  await transferSelect.click();
  await page.getByRole('option', { name: "Don't transfer (Delete all documents)" }).click();
  await expect(transferSelect).toHaveText("Don't transfer (Delete all documents)");

  await page.getByRole('button', { name: 'Delete' }).click();

  await expectTextToBeVisible(page, 'Your team has been successfully deleted');

  expect(await prisma.team.findUnique({ where: { id: team.id } })).toBeNull();
  expect(await prisma.envelope.findUnique({ where: { id: document.id } })).toBeNull();
});

test('[TEAMS]: delete team and transfer documents to another team', async ({ page }) => {
  const { user, team, organisation } = await seedUser();
  const otherTeam = await seedSiblingTeam(user.id, organisation.id);
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings`,
  });

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByLabel(`Confirm by typing delete ${team.name}`).fill(`delete ${team.name}`);

  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option', { name: otherTeam.name }).click();

  await page.getByRole('button', { name: 'Delete' }).click();

  await expectTextToBeVisible(page, 'Your team has been successfully deleted');

  expect(await prisma.team.findUnique({ where: { id: team.id } })).toBeNull();

  const transferredDocument = await prisma.envelope.findUnique({ where: { id: document.id } });

  expect(transferredDocument?.teamId).toBe(otherTeam.id);
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

  await page.getByRole('button', { name: 'Save changes' }).click();

  // Check we have been redirected to the new team URL and the name is updated.
  // The team settings index redirects to the explicit General route.
  await page.waitForURL(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${updatedTeamId}/settings/general`);
});

// The delete dialog only offers a transfer target when the organisation has another team.
const seedSiblingTeam = async (userId: number, organisationId: string) => {
  const teamUrl = `team-${nanoid()}`;

  await createTeam({
    userId,
    teamName: teamUrl,
    teamUrl,
    organisationId,
    inheritMembers: true,
  });

  return await prisma.team.findUniqueOrThrow({ where: { url: teamUrl } });
};
