import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { TeamMemberRole } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';

/**
 * Every seeded user is given their own organisation. Removing it leaves the user with only
 * the access that was explicitly granted, which is how we reach the "team access only" and
 * "no organisations at all" states.
 */
const deleteOwnedOrganisations = async (userId: number) => {
  await prisma.organisation.deleteMany({
    where: {
      ownerUserId: userId,
    },
  });
};

test.describe('Unified Settings', () => {
  test('shows both groups for the team owner at team scope', async ({ page }) => {
    const { owner, team, organisation } = await seedTeam();

    await apiSignin({ page, email: owner.email });
    await page.goto(`/t/${team.url}/settings`);

    const sidebar = page.getByTestId('unified-settings-sidebar');
    await expect(sidebar).toBeVisible();

    const groups = sidebar.getByTestId('unified-settings-sidebar-group');
    // Organisation + Team groups, plus the always-visible Account group.
    await expect(groups).toHaveCount(3);

    await expect(sidebar.getByTestId('settings-org-switcher-trigger')).toContainText(organisation.name);
    await expect(sidebar.getByTestId('settings-team-switcher-trigger')).toContainText(team.name);

    // Nav item labels are lingui `msg` descriptors resolved to strings at render —
    // assert the visible text so a broken translation (blank / [object Object])
    // would fail here. Test ids are scope-qualified because item keys repeat across groups.
    await expect(sidebar.getByTestId('unified-settings-nav-team-members')).toContainText('Members');
    await expect(sidebar.getByTestId('unified-settings-nav-team-preferences')).toContainText('Preferences');
    await expect(sidebar.getByTestId('unified-settings-nav-organisation-members')).toContainText('Members');
    await expect(sidebar.getByTestId('unified-settings-nav-account-profile')).toContainText('Profile');
  });

  test('shows both groups for the team owner at org scope (team-fallback)', async ({ page }) => {
    const { owner, team, organisation } = await seedTeam();

    await apiSignin({ page, email: owner.email });
    // At org scope `useOptionalCurrentTeam()` is null, but the layout falls
    // back to the user's first manageable team in the current org so both
    // groups still render.
    await page.goto(`/o/${organisation.url}/settings`);

    const sidebar = page.getByTestId('unified-settings-sidebar');
    await expect(sidebar).toBeVisible();

    const groups = sidebar.getByTestId('unified-settings-sidebar-group');
    // Organisation + Team groups, plus the always-visible Account group.
    await expect(groups).toHaveCount(3);

    await expect(sidebar.getByTestId('settings-org-switcher-trigger')).toContainText(organisation.name);
    // Team switcher shows the fallback team (the user's first manageable team in this org).
    await expect(sidebar.getByTestId('settings-team-switcher-trigger')).toContainText(team.name);

    // The empty state is only for users who can't manage the organisation.
    await expect(sidebar.getByTestId('unified-settings-organisation-empty-state')).toHaveCount(0);
  });

  test('sidebar is flush with the left viewport edge', async ({ page }) => {
    const { owner, organisation } = await seedTeam();

    // Wide viewport — a centered max-w-screen-xl container would offset the
    // sidebar by (1600 - 1280) / 2 = 160px+, while flush-left is ~16px (the
    // aside's own internal padding).
    await page.setViewportSize({ width: 1600, height: 900 });

    await apiSignin({ page, email: owner.email });
    await page.goto(`/o/${organisation.url}/settings`);

    const sidebar = page.getByTestId('unified-settings-sidebar');
    await expect(sidebar).toBeVisible();

    const box = await sidebar.boundingBox();

    expect(box?.x ?? Number.MAX_SAFE_INTEGER).toBeLessThan(100);

    // The app header stretches to the full viewport width on settings pages.
    const headerContainer = page.getByTestId('app-header-container');
    const headerBox = await headerContainer.boundingBox();

    expect(headerBox?.x ?? Number.MAX_SAFE_INTEGER).toBeLessThan(50);
    expect((headerBox?.x ?? 0) + (headerBox?.width ?? 0)).toBeGreaterThan(1550);

    // Outside of settings the header keeps its centered max-w-screen-xl container.
    await page.goto(`/o/${organisation.url}`);
    await expect(headerContainer).toBeVisible();

    const centeredHeaderBox = await headerContainer.boundingBox();

    expect(centeredHeaderBox?.x ?? 0).toBeGreaterThan(100);
  });

  test('content is centered within the pane beside the sidebar', async ({ page }) => {
    const { owner, organisation } = await seedTeam();

    await page.setViewportSize({ width: 1600, height: 900 });

    await apiSignin({ page, email: owner.email });
    await page.goto(`/o/${organisation.url}/settings`);

    const content = page.getByTestId('unified-settings-content');
    await expect(content).toBeVisible();

    const contentBox = await content.boundingBox();

    // The pane spans from the sidebar's right edge (fixed 320px aside) to the
    // viewport edge. The content container should be centered within it.
    const paneCenter = (320 + 1600) / 2;
    const contentCenter = (contentBox?.x ?? 0) + (contentBox?.width ?? 0) / 2;

    expect(Math.abs(contentCenter - paneCenter)).toBeLessThan(24);
  });

  test('keeps current section when switching teams', async ({ page }) => {
    // Seed one team, then add a second team to the same organisation.
    const { owner, team: team1, organisation } = await seedTeam();

    const team2Url = `team-two-${nanoid()}`;

    await createTeam({
      userId: owner.id,
      teamName: 'Team Two',
      teamUrl: team2Url,
      organisationId: organisation.id,
      inheritMembers: true,
    });

    await apiSignin({ page, email: owner.email });
    await page.goto(`/t/${team1.url}/settings/members`);

    // Scope to the desktop sidebar — the mobile sidebar also renders the
    // same testid.
    const sidebar = page.getByTestId('unified-settings-sidebar');
    await sidebar.getByTestId('settings-team-switcher-trigger').click();

    // The popover content matches the trigger width.
    const triggerBox = await sidebar.getByTestId('settings-team-switcher-trigger').boundingBox();
    const contentBox = await page.getByTestId('settings-team-switcher-content').boundingBox();

    expect(Math.abs((contentBox?.width ?? 0) - (triggerBox?.width ?? -1))).toBeLessThan(2);

    await page.getByTestId(`settings-team-switcher-item-${team2Url}`).click();

    await page.waitForURL(`/t/${team2Url}/settings/members`);
    await expect(page).toHaveURL(`/t/${team2Url}/settings/members`);
  });

  test('account settings keep the organisation the user was working in', async ({ page }) => {
    // The user administers their own organisation, but only manages a team in the seeded
    // one — so the two differ in whether organisation settings are reachable.
    const { team: teamInOtherOrg, organisation: otherOrganisation } = await seedTeam();

    const user = await seedTeamMember({ teamId: teamInOtherOrg.id, role: TeamMemberRole.MANAGER });

    const ownedOrganisation = await prisma.organisation.findFirstOrThrow({
      where: { ownerUserId: user.id },
      include: { teams: true },
    });

    // Both are seeded as "Personal Organisation", so rename them to tell the switcher apart.
    await prisma.organisation.update({ where: { id: ownedOrganisation.id }, data: { name: 'Org I Administer' } });
    await prisma.organisation.update({
      where: { id: otherOrganisation.id },
      data: { name: 'Org I Only Have A Team In' },
    });

    await apiSignin({ page, email: user.email });

    const sidebar = page.getByTestId('unified-settings-sidebar');
    const orgTrigger = sidebar.getByTestId('settings-org-switcher-trigger');

    // `organisations` comes back unordered, so which one account scope falls back to isn't
    // fixed. Read it cold, then work in the *other* one — otherwise the test can pass just
    // because the fallback already happened to be the right organisation.
    await page.goto('/settings/profile');

    const fallbackIsOwned = ((await orgTrigger.textContent()) ?? '').includes('Org I Administer');

    const target = fallbackIsOwned
      ? { name: 'Org I Only Have A Team In', teamUrl: teamInOtherOrg.url }
      : { name: 'Org I Administer', teamUrl: ownedOrganisation.teams[0].url };

    await page.goto(`/t/${target.teamUrl}/settings/general`);
    await expect(orgTrigger).toContainText(target.name);

    // Account scope has no organisation in the URL either, so it must not silently jump
    // back to whichever organisation happens to be first.
    await sidebar.getByTestId('unified-settings-nav-account-profile').click();
    await page.waitForURL('/settings/profile');
    await expect(page.getByTestId('settings-scope-breadcrumb-chip')).toContainText('Account Settings');

    await expect(orgTrigger).toContainText(target.name);
  });

  test('team switcher keeps the selected team when moving to organisation scope', async ({ page }) => {
    const { owner, team: team1, organisation } = await seedTeam();

    // Lowercased to match what `ZTeamUrlSchema` stores — `createTeam` is called directly
    // here, bypassing the tRPC input schema that would normalise it in the real flow.
    const team2Url = `team-two-${nanoid()}`.toLowerCase();

    await createTeam({
      userId: owner.id,
      teamName: 'Team Two',
      teamUrl: team2Url,
      organisationId: organisation.id,
      inheritMembers: true,
    });

    await apiSignin({ page, email: owner.email });

    const sidebar = page.getByTestId('unified-settings-sidebar');
    const trigger = sidebar.getByTestId('settings-team-switcher-trigger');

    // `organisation.teams` comes back unordered, so which team the sidebar falls back to
    // isn't fixed. Read it first, then deliberately select the *other* one — otherwise the
    // test can pass simply because the fallback already happened to be the right team.
    await page.goto(`/o/${organisation.url}/settings/general`);

    const fallbackIsTeam2 = ((await trigger.textContent()) ?? '').includes('Team Two');
    const selected = fallbackIsTeam2 ? { url: team1.url, name: team1.name } : { url: team2Url, name: 'Team Two' };

    await page.goto(`/t/${team2Url}/settings/general`);
    await trigger.click();
    await page.getByTestId(`settings-team-switcher-item-${selected.url}`).click();
    await page.waitForURL(`/t/${selected.url}/settings/general`);
    await expect(trigger).toContainText(selected.name);

    // Organisation scope has no team in the URL, so the sidebar has to remember which team
    // the user picked rather than falling back to whichever one happens to be first.
    await sidebar.getByTestId('unified-settings-nav-organisation-general').click();
    await page.waitForURL(`/o/${organisation.url}/settings/general`);

    // Wait for the organisation page to actually render — asserting straight after
    // `waitForURL` can read the previous scope's still-mounted sidebar and pass falsely.
    await expect(page.getByTestId('settings-scope-breadcrumb-chip')).toContainText('Organization Settings');

    await expect(trigger).toContainText(selected.name);

    // The selection must also survive in the cookie — otherwise the app root would send the
    // user back to the wrong team.
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();

        return cookies.find((cookie) => cookie.name === 'preferred-team-url')?.value ?? null;
      })
      .toBe(selected.url);
  });

  test('inheritable field toggles between INHERITED and OVERRIDDEN', async ({ page }) => {
    const { owner, team } = await seedTeam();

    await apiSignin({ page, email: owner.email });
    await page.goto(`/t/${team.url}/settings/document`);

    const langStatus = page.getByTestId('document-language-status');
    await expect(langStatus).toHaveText(/inherited/i);

    // Open the language select and pick a non-default value.
    await page.getByTestId('document-language-trigger').click();
    await page
      .getByRole('option', { name: /english/i })
      .first()
      .click();

    await expect(langStatus).toHaveText(/override/i);

    // Selecting the inherit option stages the field back to inherited.
    await page.getByTestId('document-language-trigger').click();
    await page.getByRole('option', { name: /inherit from organization/i }).click();

    await expect(langStatus).toHaveText(/inherited/i);
  });

  test('branding fields toggle between INHERITED and OVERRIDDEN', async ({ page }) => {
    const { owner, team } = await seedTeam();

    await apiSignin({ page, email: owner.email });
    await page.goto(`/t/${team.url}/settings/branding`);

    const enabledStatus = page.getByTestId('branding-enabled-status');
    const urlStatus = page.getByTestId('branding-url-status');

    await expect(enabledStatus).toHaveText(/inherited/i);
    await expect(urlStatus).toHaveText(/inherited/i);

    // Enable branding — unlocks the other fields and overrides the tri-state select.
    await page.getByTestId('enable-branding').click();
    await page.getByRole('option', { name: /yes/i }).click();

    await expect(enabledStatus).toHaveText(/override/i);

    // Override the brand website (inherit sentinel is the empty string).
    await page.getByPlaceholder('https://example.com').fill('https://example.org');

    await expect(urlStatus).toHaveText(/override/i);

    // Clearing the field stages it back to its inherit sentinel (empty string).
    await page.getByPlaceholder('https://example.com').fill('');

    await expect(urlStatus).toHaveText(/inherited/i);
  });

  test('reminders page renders extracted fields with inheritance badges', async ({ page }) => {
    const { owner, team } = await seedTeam();

    await apiSignin({ page, email: owner.email });
    await page.goto(`/t/${team.url}/settings/reminders`);

    await expect(page.getByTestId('envelope-expiration-period-status')).toHaveText(/inherited/i);
    await expect(page.getByTestId('reminder-settings-status')).toHaveText(/inherited/i);

    // The fields were extracted out of the document preferences page.
    await page.goto(`/t/${team.url}/settings/document`);
    await expect(page.getByTestId('document-language-status')).toBeVisible();
    await expect(page.getByTestId('envelope-expiration-period-status')).not.toBeVisible();
  });

  test('certificates page renders extracted fields with inheritance badges', async ({ page }) => {
    const { owner, team } = await seedTeam();

    await apiSignin({ page, email: owner.email });
    await page.goto(`/t/${team.url}/settings/certificates`);

    await expect(page.getByTestId('include-signing-certificate-status')).toHaveText(/inherited/i);
    await expect(page.getByTestId('include-audit-log-status')).toHaveText(/inherited/i);
  });

  test('send on behalf of team lives on the email preferences page', async ({ page }) => {
    const { owner, team } = await seedTeam();

    await apiSignin({ page, email: owner.email });
    await page.goto(`/t/${team.url}/settings/email`);

    await expect(page.getByTestId('include-sender-details-status')).toHaveText(/inherited/i);

    // Moved out of the document preferences page.
    await page.goto(`/t/${team.url}/settings/document`);
    await expect(page.getByTestId('document-language-status')).toBeVisible();
    await expect(page.getByTestId('include-sender-details-status')).not.toBeVisible();
  });

  test('account settings render inside the unified layout', async ({ page }) => {
    const { owner } = await seedTeam();

    await apiSignin({ page, email: owner.email });
    await page.goto('/settings/profile');

    const sidebar = page.getByTestId('unified-settings-sidebar');
    await expect(sidebar).toBeVisible();

    // Org + team groups render via the manageable-organisation fallback, and the
    // Account group is always present.
    await expect(sidebar.getByTestId('unified-settings-sidebar-group')).toHaveCount(3);

    await expect(page.getByTestId('settings-scope-breadcrumb-chip')).toContainText('Account Settings');
  });

  test('personal team can save email preferences', async ({ page }) => {
    const { user, team } = await seedUser({ isPersonalOrganisation: true });

    await apiSignin({ page, email: user.email });
    await page.goto(`/t/${team.url}/settings/email`);

    // The sender-details field is hidden for personal orgs and its unchanged
    // inherit sentinel is echoed back on submit — the server must drop it as a
    // no-op rather than rejecting the whole update.
    await page.getByPlaceholder('noreply@example.com').fill('replies@example.com');

    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText('Email preferences updated').first()).toBeVisible({ timeout: 15_000 });
  });

  test('content pane scrolls back to top when navigating between sections', async ({ page }) => {
    const { owner, team } = await seedTeam();

    // Short (but still md+) viewport so the document preferences page overflows
    // the internally-scrolling content pane.
    await page.setViewportSize({ width: 1280, height: 720 });

    await apiSignin({ page, email: owner.email });
    await page.goto(`/t/${team.url}/settings/document`);

    // Wait for the preferences form itself — the pane only overflows once the
    // form has loaded (the query-loading spinner is shorter than the pane).
    await expect(page.getByTestId('document-language-trigger')).toBeVisible();

    // The content pane is the <main> wrapping the content container.
    const contentPane = page.getByTestId('unified-settings-content').locator('..');

    // Scroll the pane down (the document preferences page overflows it).
    await contentPane.evaluate((el) => el.scrollTo(0, el.scrollHeight));

    const scrolledOffset = await contentPane.evaluate((el) => el.scrollTop);
    expect(scrolledOffset).toBeGreaterThan(0);

    // Navigate to another section via the sidebar (the members testid exists in
    // both scope groups, so target the team group's link by href).
    await page.getByTestId('unified-settings-sidebar').locator(`a[href="/t/${team.url}/settings/members"]`).click();
    await expect(page).toHaveURL(`/t/${team.url}/settings/members`);

    await expect.poll(async () => await contentPane.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('deleted personal-layout URL returns 404', async ({ page }) => {
    const { user } = await seedUser();

    await apiSignin({ page, email: user.email });
    const response = await page.goto('/settings/document');

    expect(response?.status()).toBe(404);
  });

  test('team-only access shows the org switcher but no organisation pages', async ({ page }) => {
    const { team, organisation } = await seedTeam();

    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });
    await deleteOwnedOrganisations(manager.id);

    await apiSignin({ page, email: manager.email });
    await page.goto(`/t/${team.url}/settings/general`);

    const sidebar = page.getByTestId('unified-settings-sidebar');
    await expect(sidebar).toBeVisible();

    // The Organisation group still renders so it can host the switcher — that's the only
    // way this user can move between organisations — but it exposes no pages.
    await expect(sidebar.getByTestId('settings-org-switcher-trigger')).toContainText(organisation.name);
    await expect(sidebar.getByTestId('unified-settings-nav-organisation-general')).toHaveCount(0);
    await expect(sidebar.getByTestId('unified-settings-nav-organisation-members')).toHaveCount(0);
    await expect(sidebar.getByTestId('unified-settings-nav-organisation-billing')).toHaveCount(0);

    // An empty group would just look broken, so it explains itself directly under the switcher.
    const emptyState = sidebar.getByTestId('unified-settings-organisation-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/permission to manage this organization/i);

    // Team and account pages remain navigable.
    await expect(sidebar.getByTestId('unified-settings-nav-team-general')).toBeVisible();
    await expect(sidebar.getByTestId('unified-settings-nav-team-members')).toBeVisible();
    await expect(sidebar.getByTestId('unified-settings-nav-account-profile')).toBeVisible();
  });

  test('team-only access is rejected from organisation settings', async ({ page }) => {
    const { team, organisation } = await seedTeam();

    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });
    await deleteOwnedOrganisations(manager.id);

    await apiSignin({ page, email: manager.email });

    // Managing a team must not grant access to the organisation scope.
    await page.goto(`/o/${organisation.url}/settings/general`);

    await expect(page.getByRole('heading', { name: 'Unauthorized' })).toBeVisible();
    await expect(page.getByRole('link', { name: /go to your settings/i })).toBeVisible();
    await expect(page.getByTestId('unified-settings-sidebar')).toHaveCount(0);
  });

  test('team member without manage permission is rejected from team settings', async ({ page }) => {
    const { team } = await seedTeam();

    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    await apiSignin({ page, email: member.email });
    await page.goto(`/t/${team.url}/settings/general`);

    // The team settings loader redirects out of the settings tree on a full page load.
    await expect(page).not.toHaveURL(/\/settings\//);
    await expect(page.getByTestId('unified-settings-sidebar')).toHaveCount(0);
  });

  test('user with no organisations only sees account settings', async ({ page }) => {
    const { user } = await seedUser();

    await deleteOwnedOrganisations(user.id);

    await apiSignin({ page, email: user.email });
    await page.goto('/settings/profile');

    const sidebar = page.getByTestId('unified-settings-sidebar');
    await expect(sidebar).toBeVisible();

    await expect(sidebar.getByTestId('unified-settings-sidebar-group')).toHaveCount(1);
    await expect(sidebar.getByTestId('unified-settings-nav-account-profile')).toBeVisible();
    await expect(sidebar.getByTestId('unified-settings-nav-account-security')).toBeVisible();

    // No organisation in context means no switcher and no scoped groups.
    await expect(sidebar.getByTestId('settings-org-switcher-trigger')).toHaveCount(0);
    await expect(sidebar.getByTestId('settings-team-switcher-trigger')).toHaveCount(0);
  });

  test('switching to an organisation the user cannot manage lands in team scope', async ({ page }) => {
    const { team: otherTeam, organisation: otherOrganisation } = await seedTeam();

    // `seedTeamMember` seeds the user with their own organisation (which they own) and
    // then grants them a team role in the seeded organisation — exactly the mixed-access
    // shape the switcher has to handle.
    const manager = await seedTeamMember({ teamId: otherTeam.id, role: TeamMemberRole.MANAGER });

    const ownedOrganisation = await prisma.organisation.findFirstOrThrow({
      where: { ownerUserId: manager.id },
    });

    await apiSignin({ page, email: manager.email });
    await page.goto(`/o/${ownedOrganisation.url}/settings/members`);

    const sidebar = page.getByTestId('unified-settings-sidebar');
    await sidebar.getByTestId('settings-org-switcher-trigger').click();
    await page.getByTestId(`settings-org-switcher-item-${otherOrganisation.url}`).click();

    // `members` exists under both scopes so the section carries over, but the scope drops
    // to team because the user can't manage the destination organisation.
    await page.waitForURL(`/t/${otherTeam.url}/settings/members`);
  });

  test('switching scope falls back to General when the section does not exist there', async ({ page }) => {
    const { team: otherTeam, organisation: otherOrganisation } = await seedTeam();

    const manager = await seedTeamMember({ teamId: otherTeam.id, role: TeamMemberRole.MANAGER });

    const ownedOrganisation = await prisma.organisation.findFirstOrThrow({
      where: { ownerUserId: manager.id },
    });

    await apiSignin({ page, email: manager.email });

    // `teams` only exists under organisation scope.
    await page.goto(`/o/${ownedOrganisation.url}/settings/teams`);

    const sidebar = page.getByTestId('unified-settings-sidebar');
    await sidebar.getByTestId('settings-org-switcher-trigger').click();
    await page.getByTestId(`settings-org-switcher-item-${otherOrganisation.url}`).click();

    await page.waitForURL(`/t/${otherTeam.url}/settings/general`);
  });
});
