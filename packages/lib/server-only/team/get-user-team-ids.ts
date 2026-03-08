import { prisma } from '@documenso/prisma';

export type GetUserTeamIdsOptions = {
  userId: number;
};

/**
 * Pre-resolve all team IDs a user has access to via their organisation group memberships.
 *
 * This is significantly cheaper than using `buildTeamWhereQuery` inline in a
 * Prisma `where` clause because it avoids deep EXISTS subqueries and redundant
 * LEFT JOINs when the result is used with `teamId: { in: teamIds }`.
 */
export const getUserTeamIds = async ({ userId }: GetUserTeamIdsOptions): Promise<number[]> => {
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
    select: {
      teamId: true,
    },
  });

  // Deduplicate — a user can appear in multiple org groups that map to the same team.
  return [...new Set(teamGroups.map((tg) => tg.teamId))];
};
