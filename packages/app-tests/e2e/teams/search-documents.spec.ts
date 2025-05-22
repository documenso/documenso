import { expect, test } from '@playwright/test';
import { DocumentStatus, OrganisationMemberRole, TeamMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { seedDocuments, seedTeamDocuments } from '@documenso/prisma/seed/documents';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import { checkDocumentTabCount } from '../fixtures/documents';

test('[TEAMS]: search respects team document visibility', async ({ page }) => {
  const { user: owner, organisation, team } = await seedUser();

  const [adminUser, managerUser, memberUser] = await seedOrganisationMembers({
    organisationId: organisation.id,
    members: [
      {
        organisationRole: OrganisationMemberRole.ADMIN,
      },
      {
        organisationRole: OrganisationMemberRole.MEMBER, // Org managers = team admins so need to workaround this.
      },
      {
        organisationRole: OrganisationMemberRole.MEMBER,
      },
    ],
  });

  const managerTeamGroup = await prisma.teamGroup.findFirstOrThrow({
    where: {
      teamId: team.id,
      teamRole: TeamMemberRole.MANAGER,
    },
    include: {
      organisationGroup: true,
    },
  });

  const managerOrganisationMember = await prisma.organisationMember.findFirstOrThrow({
    where: {
      organisationId: organisation.id,
      userId: managerUser.id,
    },
  });

  await prisma.organisationGroupMember.create({
    data: {
      groupId: managerTeamGroup.organisationGroupId,
      organisationMemberId: managerOrganisationMember.id,
    },
  });

  await seedDocuments([
    {
      sender: owner,
      teamId: team.id,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        visibility: 'EVERYONE',
        title: 'Searchable Document for Everyone',
      },
    },
    {
      sender: owner,
      teamId: team.id,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        visibility: 'MANAGER_AND_ABOVE',
        title: 'Searchable Document for Managers',
      },
    },
    {
      sender: owner,
      teamId: team.id,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        visibility: 'ADMIN',
        title: 'Searchable Document for Admins',
      },
    },
  ]);

  const testCases = [
    { user: adminUser, visibleDocs: 3 },
    { user: managerUser, visibleDocs: 2 },
    { user: memberUser, visibleDocs: 1 },
  ];

  for (const { user, visibleDocs } of testCases) {
    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await page.getByPlaceholder('Search documents...').fill('Searchable');
    await page.waitForURL(/query=Searchable/);

    await checkDocumentTabCount(page, 'All', visibleDocs);

    await apiSignout({ page });
  }
});

test('[TEAMS]: search does not reveal documents from other teams', async ({ page }) => {
  const {
    team: teamA,
    teamOwner: teamAOwner,
    teamMember2: teamAMember,
  } = await seedTeamDocuments();
  const { team: teamB, teamOwner: teamBOwner } = await seedTeamDocuments();

  await seedDocuments([
    {
      sender: teamAOwner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      teamId: teamA.id,
      documentOptions: {
        visibility: 'EVERYONE',
        title: 'Unique Team A Document',
      },
    },
    {
      sender: teamBOwner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      teamId: teamB.id,
      documentOptions: {
        visibility: 'EVERYONE',
        title: 'Unique Team B Document',
      },
    },
  ]);

  await apiSignin({
    page,
    email: teamAMember.email,
    redirectPath: `/t/${teamA.url}/documents`,
  });

  await page.getByPlaceholder('Search documents...').fill('Unique');
  await page.waitForURL(/query=Unique/);

  await checkDocumentTabCount(page, 'All', 1);
  await expect(page.getByRole('link', { name: 'Unique Team A Document' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Unique Team B Document' })).not.toBeVisible();

  await apiSignout({ page });
});

test('[TEAMS]: search respects recipient visibility regardless of team visibility', async ({
  page,
}) => {
  const team = await seedTeam();
  const memberUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await seedDocuments([
    {
      sender: team.owner,
      teamId: team.id,
      recipients: [memberUser],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        visibility: 'ADMIN',
        title: 'Admin Document with Member Recipient',
      },
    },
  ]);

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByPlaceholder('Search documents...').fill('Admin Document');
  await page.waitForURL(/query=Admin(%20|\+|\s)Document/);

  await checkDocumentTabCount(page, 'All', 1);
  await expect(
    page.getByRole('link', { name: 'Admin Document with Member Recipient' }),
  ).toBeVisible();

  await apiSignout({ page });
});

test('[TEAMS]: search by recipient name respects visibility', async ({ page }) => {
  const team = await seedTeam();
  const adminUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
  const memberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
    name: 'Team Member',
  });

  const uniqueRecipient = await seedUser();

  await seedDocuments([
    {
      sender: team.owner,
      recipients: [uniqueRecipient],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Admin Document for Unique Recipient',
      },
    },
  ]);

  // Admin should see the document when searching by recipient name
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByPlaceholder('Search documents...').fill('Unique Recipient');
  await page.waitForURL(/query=Unique(%20|\+|\s)Recipient/);

  await checkDocumentTabCount(page, 'All', 1);
  await expect(
    page.getByRole('link', { name: 'Admin Document for Unique Recipient' }),
  ).toBeVisible();

  await apiSignout({ page });

  // Member should not see the document when searching by recipient name
  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await page.getByPlaceholder('Search documents...').fill('Unique Recipient');
  await page.waitForURL(/query=Unique(%20|\+|\s)Recipient/);

  await checkDocumentTabCount(page, 'All', 0);
  await expect(
    page.getByRole('link', { name: 'Admin Document for Unique Recipient' }),
  ).not.toBeVisible();

  await apiSignout({ page });
});
