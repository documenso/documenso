import type { TeamGroup } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type GetUserTeamIdsOptions = {
  userId: number;
};

/**
 * Pre-resolve all team groups a user has access to via their organisation group memberships,
 * keyed by team ID.
 *
 * This is significantly cheaper than joining team groups inline in a Prisma `findMany`
 * because it avoids deep EXISTS subqueries and redundant LEFT JOINs per row.
 */
export const getUserTeamGroups = async ({
  userId,
}: GetUserTeamIdsOptions): Promise<Map<number, TeamGroup[]>> => {
  const teamGroups = await prisma.teamGroup.findMany({
    where: {
      organisationGroup: {
        organisationGroupMembers: {
          some: {
            organisationMember: {
              userId,
            },
          },
        },
      },
    },
  });

  const map = new Map<number, TeamGroup[]>();

  for (const tg of teamGroups) {
    const existing = map.get(tg.teamId);

    if (existing) {
      existing.push(tg);
    } else {
      map.set(tg.teamId, [tg]);
    }
  }

  return map;
};
