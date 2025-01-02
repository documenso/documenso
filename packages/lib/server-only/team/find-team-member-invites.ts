import type { TeamMemberInvite } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { P, match } from 'ts-pattern';
import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamMemberInviteSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamMemberInviteSchema';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { type FindResultResponse, ZFindResultResponse } from '../../types/search-params';

export interface FindTeamMemberInvitesOptions {
  userId: number;
  teamId: number;
  query?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof TeamMemberInvite;
    direction: 'asc' | 'desc';
  };
}

export const ZFindTeamMemberInvitesResponseSchema = ZFindResultResponse.extend({
  data: TeamMemberInviteSchema.pick({
    id: true,
    teamId: true,
    email: true,
    role: true,
    createdAt: true,
  }).array(),
});

export type TFindTeamMemberInvitesResponse = z.infer<typeof ZFindTeamMemberInvitesResponseSchema>;

export const findTeamMemberInvites = async ({
  userId,
  teamId,
  query,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamMemberInvitesOptions): Promise<TFindTeamMemberInvitesResponse> => {
  const orderByColumn = orderBy?.column ?? 'email';
  const orderByDirection = orderBy?.direction ?? 'desc';

  // Check that the user belongs to the team they are trying to find invites in.
  const userTeam = await prisma.team.findUniqueOrThrow({
    where: {
      id: teamId,
      members: {
        some: {
          userId,
          role: {
            in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
          },
        },
      },
    },
  });

  const termFilters: Prisma.TeamMemberInviteWhereInput | undefined = match(query)
    .with(P.string.minLength(1), () => ({
      email: {
        contains: query,
        mode: Prisma.QueryMode.insensitive,
      },
    }))
    .otherwise(() => undefined);

  const whereClause: Prisma.TeamMemberInviteWhereInput = {
    ...termFilters,
    teamId: userTeam.id,
  };

  const [data, count] = await Promise.all([
    prisma.teamMemberInvite.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      // Exclude token attribute.
      select: {
        id: true,
        teamId: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.teamMemberInvite.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
