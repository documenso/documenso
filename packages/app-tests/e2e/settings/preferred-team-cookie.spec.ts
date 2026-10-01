import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedTeam } from '@documenso/prisma/seed/teams';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { OrganisationMemberRole } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';

const readPreferredTeamUrl = async (page: Page) => {
  const cookies = await page.context().cookies();

  return cookies.find((cookie) => cookie.name === 'preferred-team-url')?.value ?? null;
};

/**
 * Two organisations the signed-in user administers, each with its own team.
 */
const seedTwoOrganisations = async () => {
  const { owner, team: teamA, organisation: orgA } = await seedTeam();
  const { organisation: orgB, team: teamB } = await seedTeam();

  await seedOrganisationMembers({
    members: [{ email: owner.email, organisationRole: OrganisationMemberRole.ADMIN }],
    organisationId: orgB.id,
  });

  return { owner, orgA, teamA, orgB, teamB };
};

const switchOrganisationInSettings = async (page: Page, organisationUrl: string) => {
  const sidebar = page.getByTestId('unified-settings-sidebar');

  await sidebar.getByTestId('settings-org-switcher-trigger').click();
  await page.getByTestId(`settings-org-switcher-item-${organisationUrl}`).click();
  await page.waitForURL(`/o/${organisationUrl}/settings/general`);
};

test.describe('Preferred team cookie', () => {
  test('switching organisation in settings records a team from that organisation', async ({ page }) => {
    const { owner, teamA, orgB, teamB } = await seedTwoOrganisations();

    await apiSignin({ page, email: owner.email });

    await page.goto(`/t/${teamA.url}/settings/general`);
    expect(await readPreferredTeamUrl(page)).toBe(teamA.url);

    await switchOrganisationInSettings(page, orgB.url);

    // Recorded by the settings layout, which posts asynchronously rather than blocking the
    // navigation, so the swap lands shortly after the URL changes.
    await expect.poll(() => readPreferredTeamUrl(page)).toBe(teamB.url);
  });

  test('app root redirects into the organisation last selected in settings', async ({ page }) => {
    const { owner, teamA, orgB, teamB } = await seedTwoOrganisations();

    await apiSignin({ page, email: owner.email });

    await page.goto(`/t/${teamA.url}/settings/general`);
    await switchOrganisationInSettings(page, orgB.url);

    await expect.poll(() => readPreferredTeamUrl(page)).toBe(teamB.url);

    await page.goto('/');
    await expect(page).toHaveURL(`/t/${teamB.url}/documents`);
  });

  test('switching team in settings records the newly selected team', async ({ page }) => {
    const { owner, teamA, orgB, teamB } = await seedTwoOrganisations();

    await apiSignin({ page, email: owner.email });

    await page.goto(`/t/${teamB.url}/settings/general`);
    expect(await readPreferredTeamUrl(page)).toBe(teamB.url);

    await page.goto(`/t/${teamA.url}/settings/general`);
    expect(await readPreferredTeamUrl(page)).toBe(teamA.url);

    await page.goto('/');
    await expect(page).toHaveURL(`/t/${teamA.url}/documents`);
  });
});
