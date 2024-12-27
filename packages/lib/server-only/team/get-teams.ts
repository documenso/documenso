import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamMemberSchema, TeamSchema } from '@documenso/prisma/generated/zod';

export type GetTeamsOptions = {
  userId: number;
};

export const ZGetTeamsResponseSchema = TeamSchema.extend({
  currentTeamMember: TeamMemberSchema.pick({
    role: true,
  }),
}).array();

export type TGetTeamsResponse = z.infer<typeof ZGetTeamsResponseSchema>;

export const getTeams = async ({ userId }: GetTeamsOptions): Promise<TGetTeamsResponse> => {
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        where: {
          userId,
        },
        select: {
          role: true,
        },
      },
    },
  });

  return teams.map(({ members, ...team }) => ({
    ...team,
    currentTeamMember: members[0],
  }));
};
