// ABOUTME: Builds Prisma where-clause for folder access control.
// Combines role-based visibility with per-user and per-group access lists.
import type { Prisma } from '@prisma/client';
import { TeamMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../constants/teams';

export const getUserTeamGroupIds = async (userId: number, teamId: number): Promise<string[]> => {
  const memberships = await prisma.organisationGroupMember.findMany({
    where: {
      organisationMember: { userId },
      group: { teamGroups: { some: { teamId } } },
    },
    select: { groupId: true },
  });

  return memberships.map((m) => m.groupId);
};

export const buildFolderAccessFilter = (
  userId: number,
  teamRole: TeamMemberRole,
  userGroupIds: string[] = [],
): Prisma.FolderWhereInput => {
  if (teamRole === TeamMemberRole.ADMIN) {
    return {
      visibility: {
        in: TEAM_DOCUMENT_VISIBILITY_MAP[teamRole],
      },
    };
  }

  const orClauses: Prisma.FolderWhereInput[] = [
    {
      allowedUserIds: { isEmpty: true },
      allowedGroupIds: { isEmpty: true },
      visibility: { in: TEAM_DOCUMENT_VISIBILITY_MAP[teamRole] },
    },
    { allowedUserIds: { has: userId } },
    { userId },
  ];

  if (userGroupIds.length > 0) {
    orClauses.push({ allowedGroupIds: { hasSome: userGroupIds } });
  }

  return { OR: orClauses };
};
