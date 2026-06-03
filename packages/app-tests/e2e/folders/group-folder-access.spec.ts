// ABOUTME: E2E tests for group-based folder access control via allowedGroupIds.
// Verifies that folders restricted by group are visible only to group members and admins.
import { expect, test } from '@playwright/test';

import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import {
  DocumentVisibility,
  OrganisationGroupType,
  OrganisationMemberRole,
  TeamMemberRole,
} from '@documenso/prisma/client';
import { seedTeamDocuments } from '@documenso/prisma/seed/documents';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedTeamMember } from '@documenso/prisma/seed/teams';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

const createCustomGroupWithMembers = async ({
  organisationId,
  teamId,
  groupName,
  memberUserIds,
}: {
  organisationId: string;
  teamId: number;
  groupName: string;
  memberUserIds: number[];
}) => {
  const groupId = generateDatabaseId('org_group');

  await prisma.organisationGroup.create({
    data: {
      id: groupId,
      name: groupName,
      type: OrganisationGroupType.CUSTOM,
      organisationRole: OrganisationMemberRole.MEMBER,
      organisationId,
    },
  });

  const teamGroupId = generateDatabaseId('team_group');

  await prisma.teamGroup.create({
    data: {
      id: teamGroupId,
      organisationGroupId: groupId,
      teamRole: TeamMemberRole.MEMBER,
      teamId,
    },
  });

  for (const userId of memberUserIds) {
    const orgMember = await prisma.organisationMember.findFirstOrThrow({
      where: { userId, organisationId },
    });

    await prisma.organisationGroupMember.create({
      data: {
        id: generateDatabaseId('group_member'),
        groupId,
        organisationMemberId: orgMember.id,
      },
    });
  }

  return { groupId, teamGroupId };
};

test('[GROUPS]: member in group sees folder restricted to their group', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const memberA = await seedTeamMember({
    teamId: team.id,
    name: 'Group A Member',
    role: TeamMemberRole.MEMBER,
  });

  const memberB = await seedTeamMember({
    teamId: team.id,
    name: 'Group B Member',
    role: TeamMemberRole.MEMBER,
  });

  const { groupId: groupAId } = await createCustomGroupWithMembers({
    organisationId: team.organisationId,
    teamId: team.id,
    groupName: 'Group A',
    memberUserIds: [memberA.id],
  });

  const { groupId: groupBId } = await createCustomGroupWithMembers({
    organisationId: team.organisationId,
    teamId: team.id,
    groupName: 'Group B',
    memberUserIds: [memberB.id],
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Group A Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      allowedGroupIds: [groupAId],
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Group B Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      allowedGroupIds: [groupBId],
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Open Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
    },
  });

  await apiSignin({
    page,
    email: memberA.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Group A Folder')).toBeVisible();
  await expect(page.getByText('Group B Folder')).not.toBeVisible();
  await expect(page.getByText('Open Folder')).toBeVisible();

  await apiSignin({
    page,
    email: memberB.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Group A Folder')).not.toBeVisible();
  await expect(page.getByText('Group B Folder')).toBeVisible();
  await expect(page.getByText('Open Folder')).toBeVisible();
});

test('[GROUPS]: admin sees all group-restricted folders', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const memberA = await seedTeamMember({
    teamId: team.id,
    name: 'Group Member',
    role: TeamMemberRole.MEMBER,
  });

  const { groupId } = await createCustomGroupWithMembers({
    organisationId: team.organisationId,
    teamId: team.id,
    groupName: 'Restricted Group',
    memberUserIds: [memberA.id],
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Restricted Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      allowedGroupIds: [groupId],
    },
  });

  await apiSignin({
    page,
    email: teamOwner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Restricted Folder')).toBeVisible();
});

test('[GROUPS]: member not in any group cannot see group-restricted folder', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const memberA = await seedTeamMember({
    teamId: team.id,
    name: 'Group Member',
    role: TeamMemberRole.MEMBER,
  });

  const outsider = await seedTeamMember({
    teamId: team.id,
    name: 'Non-Group Member',
    role: TeamMemberRole.MEMBER,
  });

  const { groupId } = await createCustomGroupWithMembers({
    organisationId: team.organisationId,
    teamId: team.id,
    groupName: 'Exclusive Group',
    memberUserIds: [memberA.id],
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Exclusive Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      allowedGroupIds: [groupId],
    },
  });

  await apiSignin({
    page,
    email: outsider.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Exclusive Folder')).not.toBeVisible();

  await apiSignin({
    page,
    email: memberA.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Exclusive Folder')).toBeVisible();
});

test('[GROUPS]: member in multiple groups sees all their group folders', async ({ page }) => {
  const { team, teamOwner } = await seedTeamDocuments();

  const multiMember = await seedTeamMember({
    teamId: team.id,
    name: 'Multi Group Member',
    role: TeamMemberRole.MEMBER,
  });

  const { groupId: group1Id } = await createCustomGroupWithMembers({
    organisationId: team.organisationId,
    teamId: team.id,
    groupName: 'Location 1',
    memberUserIds: [multiMember.id],
  });

  const { groupId: group2Id } = await createCustomGroupWithMembers({
    organisationId: team.organisationId,
    teamId: team.id,
    groupName: 'Location 2',
    memberUserIds: [multiMember.id],
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Location 1 Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      allowedGroupIds: [group1Id],
    },
  });

  await seedBlankFolder(teamOwner, team.id, {
    createFolderOptions: {
      name: 'Location 2 Folder',
      teamId: team.id,
      visibility: DocumentVisibility.EVERYONE,
      allowedGroupIds: [group2Id],
    },
  });

  await apiSignin({
    page,
    email: multiMember.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByText('Location 1 Folder')).toBeVisible();
  await expect(page.getByText('Location 2 Folder')).toBeVisible();
});
