import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { OrganisationGroupType, OrganisationMemberRole, TeamMemberRole } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

/**
 * Calls a team-group tRPC mutation directly, bypassing the UI.
 *
 * The UI only ever surfaces CUSTOM / INTERNAL_ORGANISATION groups, so these
 * authorisation rules must be enforced on the server - a crafted request can
 * target any `teamGroupId`, including the system-managed INTERNAL_TEAM groups.
 */
const callTeamGroupMutation = (
  page: Page,
  procedure: 'team.group.delete' | 'team.group.update',
  teamId: number,
  input: Record<string, unknown>,
) =>
  page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/${procedure}`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({ json: input }),
  });

/**
 * Every team is created with three system-managed INTERNAL_TEAM groups
 * (admin/manager/member). They are the backbone of team-specific access and,
 * like organisation internal groups, must not be deletable - deleting them
 * silently strips team members of access while leaving the team row in place.
 */
test('[TEAMS]: internal team groups cannot be deleted via the API', async ({ page }) => {
  // Member inheritance OFF: membership is granted exclusively through the team's
  // INTERNAL_TEAM groups, so removing them is what causes the access loss.
  const { user: owner, team } = await seedUser({ inheritMembers: false });

  // A direct team member whose access depends on the INTERNAL_TEAM member group.
  const directMember = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await apiSignin({ page, email: owner.email });

  const internalTeamGroups = await prisma.teamGroup.findMany({
    where: {
      teamId: team.id,
      organisationGroup: { type: OrganisationGroupType.INTERNAL_TEAM },
    },
  });

  // admin + manager + member.
  expect(internalTeamGroups).toHaveLength(3);

  for (const group of internalTeamGroups) {
    const response = await callTeamGroupMutation(page, 'team.group.delete', team.id, {
      teamId: team.id,
      teamGroupId: group.id,
    });

    expect(response.status(), `INTERNAL_TEAM ${group.teamRole} group must not be deletable`).not.toBe(200);
  }

  // None of the internal groups were removed.
  const remaining = await prisma.teamGroup.count({
    where: {
      teamId: team.id,
      organisationGroup: { type: OrganisationGroupType.INTERNAL_TEAM },
    },
  });

  expect(remaining).toBe(3);

  // The direct member therefore keeps their team access.
  const memberStillHasAccess = await prisma.teamGroup.findFirst({
    where: {
      teamId: team.id,
      organisationGroup: {
        type: OrganisationGroupType.INTERNAL_TEAM,
        organisationGroupMembers: {
          some: { organisationMember: { userId: directMember.id } },
        },
      },
    },
  });

  expect(memberStillHasAccess).not.toBeNull();
});

/**
 * Guards against over-blocking: user-created (CUSTOM) team groups are not
 * internal and must remain removable by team managers/admins.
 */
test('[TEAMS]: custom team groups can still be deleted', async ({ page }) => {
  const { user: owner, organisation, team } = await seedUser({ inheritMembers: false });

  const customGroup = await prisma.organisationGroup.create({
    data: {
      id: generateDatabaseId('org_group'),
      name: `custom-${team.url}`,
      type: OrganisationGroupType.CUSTOM,
      organisationRole: OrganisationMemberRole.MEMBER,
      organisationId: organisation.id,
      teamGroups: {
        create: {
          id: generateDatabaseId('team_group'),
          teamId: team.id,
          teamRole: TeamMemberRole.MEMBER,
        },
      },
    },
    include: { teamGroups: true },
  });

  const customTeamGroup = customGroup.teamGroups[0];

  await apiSignin({ page, email: owner.email });

  const response = await callTeamGroupMutation(page, 'team.group.delete', team.id, {
    teamId: team.id,
    teamGroupId: customTeamGroup.id,
  });

  expect(response.status()).toBe(200);

  const deleted = await prisma.teamGroup.findUnique({ where: { id: customTeamGroup.id } });

  expect(deleted).toBeNull();
});

/**
 * The same root cause affects updates: an INTERNAL_TEAM group's role must not be
 * editable either, otherwise a team admin could rewrite the backbone roles
 * (e.g. promote the member group to admin).
 */
test('[TEAMS]: internal team groups cannot be updated via the API', async ({ page }) => {
  const { user: owner, team } = await seedUser({ inheritMembers: false });

  await apiSignin({ page, email: owner.email });

  const internalMemberGroup = await prisma.teamGroup.findFirstOrThrow({
    where: {
      teamId: team.id,
      teamRole: TeamMemberRole.MEMBER,
      organisationGroup: { type: OrganisationGroupType.INTERNAL_TEAM },
    },
  });

  const response = await callTeamGroupMutation(page, 'team.group.update', team.id, {
    id: internalMemberGroup.id,
    data: { teamRole: TeamMemberRole.ADMIN },
  });

  expect(response.status()).not.toBe(200);

  const reloaded = await prisma.teamGroup.findUniqueOrThrow({ where: { id: internalMemberGroup.id } });

  expect(reloaded.teamRole).toBe(TeamMemberRole.MEMBER);
});
