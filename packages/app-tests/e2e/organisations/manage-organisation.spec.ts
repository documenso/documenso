import { expect, test } from '@playwright/test';

import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { nanoid } from '@documenso/lib/universal/id';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import { expectTextToBeVisible, expectTextToNotBeVisible } from '../fixtures/generic';

test('[ORGANISATIONS]: create and delete organisation', async ({ page }) => {
  const { user, organisation } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/settings/organisations`,
  });

  await expect(page.getByRole('button', { name: 'Leave' })).toBeDisabled();

  await page.getByRole('link', { name: 'Manage' }).click();
  await page.waitForURL(`/org/${organisation.url}/settings/general`);

  await page.getByRole('button', { name: 'Delete' }).click();
  await page
    .getByLabel(`Confirm by typing delete ${organisation.name}`)
    .fill(`delete ${organisation.name}`);
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForURL(`/settings/organisations`);
  await expect(page.getByText('No results found')).toBeVisible();
  await page.getByRole('button', { name: 'Create organisation' }).click();

  await page.getByLabel('Organisation Name*').fill('test');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Your organisation has been created').first()).toBeVisible();
  await page.reload();

  await page.getByRole('row').filter({ hasText: 'test' }).getByRole('link').nth(1).click();
});

test('[ORGANISATIONS]: manage general settings', async ({ page }) => {
  const { user, organisation } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/org/${organisation.url}/settings/general`,
  });

  const updatedOrganisationId = `organisation-${Date.now()}`;

  // Update team.
  await page.getByLabel('Organisation Name*').click();
  await page.getByLabel('Organisation Name*').clear();
  await page.getByLabel('Organisation Name*').fill(updatedOrganisationId);
  await page.getByLabel('Organisation URL*').click();
  await page.getByLabel('Organisation URL*').clear();
  await page.getByLabel('Organisation URL*').fill(updatedOrganisationId);

  await page.getByRole('button', { name: 'Update organisation' }).click();

  // Check we have been redirected to the new organisation URL and the name is updated.
  await page.waitForURL(`/org/${updatedOrganisationId}/settings/general`);
});

test('[ORGANISATIONS]: inherit members', async ({ page }) => {
  const { user, organisation, team: teamWithInheritMembers } = await seedUser();

  const teamWithoutInheritedMembersUrl = `team-${nanoid()}`;

  await createTeam({
    userId: user.id,
    teamName: 'No inherit',
    teamUrl: teamWithoutInheritedMembersUrl,
    organisationId: organisation.id,
    inheritMembers: false,
  });

  const memberEmail = `member-${nanoid()}@test.documenso.com`;
  const memberEmail2 = `member-2-${nanoid()}@test.documenso.com`;
  const memberEmail3 = `member-3-${nanoid()}@test.documenso.com`;
  const managerEmail = `manager-${nanoid()}@test.documenso.com`;
  const adminEmail = `admin-${nanoid()}@test.documenso.com`;
  const ownerEmail = user.email;

  await seedOrganisationMembers({
    members: [
      {
        email: memberEmail,
        name: 'Member 1',
        organisationRole: 'MEMBER',
      },
      {
        email: memberEmail2,
        name: 'Member 2',
        organisationRole: 'MEMBER',
      },
      {
        email: memberEmail3,
        name: 'Member 3',
        organisationRole: 'MEMBER',
      },
      {
        email: managerEmail,
        name: 'Manager',
        organisationRole: 'MANAGER',
      },
      {
        email: adminEmail,
        name: 'Admin',
        organisationRole: 'ADMIN',
      },
    ],
    organisationId: organisation.id,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${teamWithoutInheritedMembersUrl}/settings/members`,
  });

  // Check from admin POV that member counts are correct
  // You should only see the manager/admins from the organisation in this table.
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Admin' }).getByText(managerEmail),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Admin' }).getByText(adminEmail),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Admin' }).getByText(ownerEmail),
  ).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: memberEmail })).not.toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: memberEmail2 })).not.toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: memberEmail3 })).not.toBeVisible();

  // Explicitly add a member to the team.
  await page.getByRole('button', { name: 'Add members' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Member 1' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add Members' }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Member' }).getByText(memberEmail),
  ).toBeVisible();

  await page.goto(`/t/${teamWithInheritMembers.url}/settings/members`);

  // Check from member POV that member counts are correct for inherit members team.
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Admin' }).getByText(managerEmail),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Admin' }).getByText(adminEmail),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Admin' }).getByText(ownerEmail),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Member' }).getByText(memberEmail),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Member' }).getByText(memberEmail2),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Member' }).getByText(memberEmail3),
  ).toBeVisible();

  // Disable inherit mode.
  await page.goto(`/t/${teamWithInheritMembers.url}/settings/groups`);
  await page.getByRole('button', { name: 'Disable access' }).click();
  await page.getByRole('button', { name: 'Disable' }).click();
  await expect(page.getByText('Enable Access').first()).toBeVisible();

  // Expect the inherited members to disappear
  await page.goto(`/t/${teamWithInheritMembers.url}/settings/members`);
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Admin' }).getByText(managerEmail),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Admin' }).getByText(adminEmail),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Admin' }).getByText(ownerEmail),
  ).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: memberEmail })).not.toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: memberEmail2 })).not.toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: memberEmail3 })).not.toBeVisible();
});

test('[ORGANISATIONS]: manage groups and members', async ({ page }) => {
  const { user, organisation, team: teamInherit } = await seedUser();

  const teamInheritName = teamInherit.name;

  const teamA = `team-${nanoid()}`;
  const teamAName = `TeamA - No inherit`;
  const teamB = `team-${nanoid()}`;
  const teamBName = `TeamB - No inherit`;

  await createTeam({
    userId: user.id,
    teamName: teamAName,
    teamUrl: teamA,
    organisationId: organisation.id,
    inheritMembers: false,
  });

  await createTeam({
    userId: user.id,
    teamName: teamBName,
    teamUrl: teamB,
    organisationId: organisation.id,
    inheritMembers: false,
  });

  const memberEmail1 = `member-1-${nanoid()}@test.documenso.com`;
  const memberEmail2 = `member-2-${nanoid()}@test.documenso.com`;
  const memberEmail3 = `member-3-${nanoid()}@test.documenso.com`;
  const memberEmail4 = `member-4-${nanoid()}@test.documenso.com`;
  const memberEmail5 = `member-5-${nanoid()}@test.documenso.com`;
  const memberEmail6 = `member-6-${nanoid()}@test.documenso.com`;

  const adminEmail1 = `admin-1-${nanoid()}@test.documenso.com`;
  const adminEmail2 = `admin-2-${nanoid()}@test.documenso.com`;
  const adminEmail3 = `admin-3-${nanoid()}@test.documenso.com`;

  const ownerEmail = user.email;

  await seedOrganisationMembers({
    members: [
      {
        email: memberEmail1,
        name: 'Member1',
        organisationRole: 'MEMBER',
      },
      {
        email: memberEmail2,
        name: 'Member2',
        organisationRole: 'MEMBER',
      },
      {
        email: memberEmail3,
        name: 'Member3',
        organisationRole: 'MEMBER',
      },
      {
        email: memberEmail4,
        name: 'Member4',
        organisationRole: 'MEMBER',
      },
      {
        email: memberEmail5,
        name: 'Member5',
        organisationRole: 'MEMBER',
      },
      {
        email: memberEmail6,
        name: 'Member6',
        organisationRole: 'MEMBER',
      },
      {
        email: adminEmail1,
        name: 'Admin1',
        organisationRole: 'ADMIN',
      },
      {
        email: adminEmail2,
        name: 'Admin2',
        organisationRole: 'ADMIN',
      },
      {
        email: adminEmail3,
        name: 'Admin3',
        organisationRole: 'ADMIN',
      },
    ],
    organisationId: organisation.id,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/org/${organisation.url}/settings/groups`,
  });

  // Create a custom group A with 3 members "ORGANISATION ADMIN" to check that they get the correct roles.
  await page.getByRole('button', { name: 'Create group' }).click();
  await page.getByRole('textbox', { name: 'Group Name *' }).fill('CUSTOM_GROUP');
  await page.getByRole('combobox').filter({ hasText: 'Organisation Member' }).click();
  await page.getByRole('option', { name: 'Organisation Admin' }).click();
  await page.getByRole('combobox').filter({ hasText: 'Select members' }).click();
  await page.getByRole('option', { name: 'Member1' }).click();
  await page.getByRole('option', { name: 'Member2' }).click();
  await page.getByRole('option', { name: 'Member3' }).click();
  await page.getByTestId('dialog-create-organisation-button').click();
  await expect(page.getByText('Group has been created.').first()).toBeVisible();

  await page.goto(`/org/${organisation.url}/settings/members`);

  // Confirm org roles have been applied to these members.
  await expect(
    page.getByRole('row').filter({ hasText: 'Organisation Admin' }).getByText(memberEmail1),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Organisation Admin' }).getByText(memberEmail2),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Organisation Admin' }).getByText(memberEmail3),
  ).toBeVisible();

  // Test updating the group.
  await page.goto(`/org/${organisation.url}/settings/groups`);
  await page.getByRole('link', { name: 'Manage' }).click();
  await page.getByRole('textbox', { name: 'Group Name *' }).fill('CUSTOM_GROUP_A');
  await page.getByRole('combobox').filter({ hasText: 'Organisation Admin' }).click();
  await page.getByRole('option', { name: 'Organisation Member' }).click();
  await page.getByRole('combobox').filter({ hasText: 'Member1, Member2, Member3' }).click();
  await page.getByRole('option', { name: 'Member3' }).click();
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByText('Group has been updated successfully').first()).toBeVisible();

  await page.goto(`/org/${organisation.url}/settings/groups`);

  // Create a custom member group with the 3 admins to check that they still get the ADMIN roles.
  await page.getByRole('button', { name: 'Create group' }).click();
  await page.getByRole('textbox', { name: 'Group Name *' }).fill('CUSTOM_GROUP_ADMINS');
  await page.getByRole('combobox').filter({ hasText: 'Select members' }).click();
  await page.getByRole('option', { name: 'Admin1' }).click();
  await page.getByRole('option', { name: 'Admin2' }).click();
  await page.getByRole('option', { name: 'Admin3' }).click();
  await page.getByTestId('dialog-create-organisation-button').click();
  await expect(page.getByText('Group has been created.').first()).toBeVisible();

  await page.goto(`/org/${organisation.url}/settings/members`);

  // Confirm admins still get admin roles.
  await expect(
    page.getByRole('row').filter({ hasText: 'Organisation Admin' }).getByText(adminEmail1),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Organisation Admin' }).getByText(adminEmail2),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Organisation Admin' }).getByText(adminEmail3),
  ).toBeVisible();

  // Create another custom group with 3 members with "ORGANISATION MEMBER" role.
  await page.goto(`/org/${organisation.url}/settings/groups`);
  await page.getByRole('button', { name: 'Create group' }).click();
  await page.getByRole('textbox', { name: 'Group Name *' }).fill('CUSTOM_GROUP_B');
  await page.getByRole('combobox').filter({ hasText: 'Organisation Member' }).click();
  await page.getByRole('option', { name: 'Organisation Admin' }).click();
  await page.getByRole('combobox').filter({ hasText: 'Select members' }).click();
  await page.getByRole('option', { name: 'Member4' }).click();
  await page.getByRole('option', { name: 'Member5' }).click();
  await page.getByTestId('dialog-create-organisation-button').click();
  await expect(page.getByText('Group has been created.').first()).toBeVisible();

  // Assign CUSTOM_GROUP_A to TeamA
  await page.goto(`/t/${teamA}/settings/groups`);
  await page.getByRole('button', { name: 'Add groups' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'CUSTOM_GROUP_A', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Manager' }).click();
  await page.getByRole('button', { name: 'Create Groups' }).click();
  await expect(page.getByText('Team members have been added').first()).toBeVisible();

  // Assign CUSTOM_GROUP_B to TeamA
  await page.goto(`/t/${teamA}/settings/groups`);
  await page.getByRole('button', { name: 'Add groups' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'CUSTOM_GROUP_B', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Manager' }).click();
  await page.getByRole('button', { name: 'Create Groups' }).click();
  await expect(page.getByText('Team members have been added').first()).toBeVisible();

  // Update CUSTOM_GROUP_B
  await page.getByRole('row', { name: 'CUSTOM_GROUP_B' }).getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Update role' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Team Admin' }).click();
  await page.getByRole('button', { name: 'Update' }).click();
  await expectTextToBeVisible(page, 'You have updated the team group');
  await expect(page.getByText('Team Admin').first()).toBeVisible();
  await page.reload();

  // Delete CUSTOM_GROUP_B
  await page.getByRole('row', { name: 'CUSTOM_GROUP_B' }).getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expectTextToBeVisible(page, 'You have successfully removed this group from the team.');
  await expect(page.getByText('CUSTOM_GROUP_B')).not.toBeVisible();

  // Navigate to team members and validate members are there.
  await page.goto(`/t/${teamA}/settings/members`);

  await expect(
    page.getByRole('row').filter({ hasText: 'Team Manager' }).getByText(memberEmail1),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Team Manager' }).getByText(memberEmail2),
  ).toBeVisible();

  // Member 1 should see inherit team and teamA
  await apiSignout({ page });
  await apiSignin({ page, email: memberEmail1 });
  await expectTextToBeVisible(page, teamInheritName);
  await expectTextToBeVisible(page, teamAName);
  await expectTextToNotBeVisible(page, teamBName);

  // Member 3 should only see inherit team
  await apiSignout({ page });
  await apiSignin({ page, email: memberEmail3 });
  await expectTextToBeVisible(page, teamInheritName);
  await expectTextToNotBeVisible(page, teamAName);
  await expectTextToNotBeVisible(page, teamBName);

  // Admin 1 should see all teams.
  await apiSignout({ page });
  await apiSignin({ page, email: adminEmail1 });
  await expectTextToBeVisible(page, teamInheritName);
  await expectTextToBeVisible(page, teamAName);
  await expectTextToBeVisible(page, teamBName);
});

test('[ORGANISATIONS]: member invites', async ({ page }) => {
  const { user, organisation, team } = await seedUser({
    inheritMembers: false,
  });

  const { user: user2 } = await seedUser();
  const { user: user3 } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/org/${organisation.url}/settings/members`,
  });

  await page.getByRole('button', { name: 'Invite member' }).click();
  await page.getByRole('textbox', { name: 'Email address *' }).click();
  await page.getByRole('textbox', { name: 'Email address *' }).fill(user2.email);
  await page.getByRole('button', { name: 'Add more' }).click();

  await page.locator('input[name="invitations\\.1\\.email"]').fill(user3.email);
  await page.getByRole('button', { name: 'Invite' }).click();

  await page.getByRole('tab', { name: 'Pending' }).click();
  await expect(page.getByText(user2.email)).toBeVisible();
  await expect(page.getByText(user3.email)).toBeVisible();

  await page.getByRole('row', { name: user3.email }).getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await expect(page.getByText('Invitation has been deleted').first()).toBeVisible();
  await expect(page.getByText(user3.email)).not.toBeVisible();

  // Sign in as member and accept invite
  await apiSignout({ page });
  await apiSignin({ page, email: user2.email });
  await page.getByRole('button', { name: 'View invites' }).click();
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Invitation accepted').first()).toBeVisible();

  // Sign back in as org owner.
  await apiSignout({ page });
  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/settings/members` });

  // Expect 1 member in team.
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByText(user2.email)).not.toBeVisible();

  // Add member to team.
  await page.getByRole('button', { name: 'Add members' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: user2.name ?? '' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add Members' }).click();

  // Expect 2 members to be visible.
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByText(user2.email)).toBeVisible();

  await page.getByRole('row', { name: user2.email }).getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('You have successfully removed').first()).toBeVisible();

  // Expect 1 member in team.
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByText(user2.email)).not.toBeVisible();

  // Expect 2 members in organisation.
  await page.goto(`/org/${organisation.url}/settings/members`);
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByText(user2.email)).toBeVisible();

  await page.getByRole('row', { name: user2.email }).getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('You have successfully removed this user').first()).toBeVisible();

  // Expect 1 member in organisation.
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByText(user2.email)).not.toBeVisible();
});

test('[ORGANISATIONS]: leave organisation', async ({ page }) => {
  const { organisation } = await seedUser();

  const memberEmail = `member-${nanoid()}@test.documenso.com`;

  await seedOrganisationMembers({
    members: [
      {
        email: memberEmail,
        name: 'Member 1',
        organisationRole: 'MEMBER',
      },
    ],
    organisationId: organisation.id,
  });

  await apiSignin({
    page,
    email: memberEmail,
    redirectPath: `/settings/organisations`,
  });
  await page.getByRole('button', { name: 'Leave' }).click();
  await page.getByRole('button', { name: 'Leave' }).click();

  await expect(
    page.getByText('You have successfully left this organisation').first(),
  ).toBeVisible();
  await expect(page.getByText('No results found').first()).toBeVisible();
});
