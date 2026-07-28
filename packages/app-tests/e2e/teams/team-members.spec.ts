import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { OrganisationMemberRole, TeamMemberRole } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { openDropdownMenu } from '../fixtures/generic';

/**
 * Reproduces the "Team has no internal team groups" bug.
 *
 * When a team has member inheritance turned OFF, organisation admins/managers are
 * still inherited into the team as team admins (shown with the "Group" source).
 * These members are not part of the team's INTERNAL_TEAM group, so they cannot be
 * removed via the team members page - attempting to do so threw a 500 ("Team has no
 * internal team groups").
 *
 * Instead of crashing, the delete dialog must explain why the inherited member can't
 * be removed and not offer a confirm button.
 */
test('[TEAMS]: explains why an inherited organisation member cannot be removed', async ({ page }) => {
  // Team created with member inheritance OFF.
  const { user: owner, organisation, team } = await seedUser({ inheritMembers: false });

  const inheritedAdminEmail = `inherited-admin-${team.url}@test.documenso.com`;

  // A second organisation admin is inherited into the team as a team admin (source "Group").
  await seedOrganisationMembers({
    organisationId: organisation.id,
    members: [
      {
        name: 'Inherited Admin',
        email: inheritedAdminEmail,
        organisationRole: OrganisationMemberRole.ADMIN,
      },
    ],
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/settings/members`,
  });

  const inheritedMemberRow = page.getByRole('row').filter({ hasText: inheritedAdminEmail });

  // Sanity check: the member is inherited from a group, not a direct team member.
  await expect(inheritedMemberRow).toBeVisible();
  await expect(inheritedMemberRow).toContainText('Group');

  await openDropdownMenu(page, inheritedMemberRow.getByRole('button').last());

  // The action stays enabled - opening it shows a dialog explaining why the inherited
  // member can't be removed, rather than triggering the 500.
  const removeMenuItem = page.getByRole('menuitem', { name: 'Remove' });
  await expect(removeMenuItem).toBeEnabled();
  await removeMenuItem.click();

  await expect(page.getByText('inherited from a group').first()).toBeVisible();

  // No confirm button is offered, so the broken removal can never be triggered.
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);
});

/**
 * Guards against over-disabling the remove action: a direct team member (one that
 * belongs to the team's INTERNAL_TEAM group) must still be removable.
 */
test('[TEAMS]: can remove a direct team member', async ({ page }) => {
  const { user: owner, team } = await seedUser({ inheritMembers: false });

  const directMember = await seedTeamMember({
    teamId: team.id,
    name: 'Direct Member',
    role: TeamMemberRole.MEMBER,
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/settings/members`,
  });

  const directMemberRow = page.getByRole('row').filter({ hasText: directMember.email });

  await expect(directMemberRow).toBeVisible();

  await openDropdownMenu(page, directMemberRow.getByRole('button').last());

  const removeMenuItem = page.getByRole('menuitem', { name: 'Remove' });

  // The "Remove" action is enabled for direct members and removing them succeeds.
  await expect(removeMenuItem).toBeEnabled();
  await removeMenuItem.click();

  await page.getByRole('button', { name: 'Remove' }).click();

  await expect(page.getByText('You have successfully removed this user from the team.').first()).toBeVisible();

  // The member is actually gone after reloading the members list.
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: owner.email })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: directMember.email })).toHaveCount(0);
});
